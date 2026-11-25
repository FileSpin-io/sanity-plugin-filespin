/**
 * Sign-in: OAuth2 Device Authorization Grant (RFC 8628), the same flow and
 * server endpoints as FileSpin's Adobe, Figma and WordPress plugins.
 *
 * Why not the authorization-code flow: that flow ends with a redirect to an
 * address registered with FileSpin in advance. Every Studio lives at its own
 * address (*.sanity.studio, a custom domain, localhost), so there is no
 * address to register. The device flow needs none:
 *
 *   1. POST /oauth/device_authorization  -> a device_code (secret) and a short
 *      user_code shown on FileSpin's approval page
 *   2. a new tab opens /activate?user_code=..., the user signs in and allows
 *   3. the plugin polls POST /oauth/token with the device_code until approved
 *
 * Server contract: filespin-saas-backend docs/reference/oauth2-device-flow.md
 */

import {SCOPES, type ResolvedConfig} from '../config'

const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

export interface DeviceAuthorization {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
}

/** A sign-in that ended for a reason the user should read. */
export class SignInError extends Error {
  constructor(
    public readonly reason: 'denied' | 'expired' | 'not_configured' | 'server' | 'cancelled',
    message: string,
  ) {
    super(message)
  }
}

async function postForm(config: ResolvedConfig, path: string, params: Record<string, string>) {
  const res = await fetch(`${config.apiBase}${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(params).toString(),
  })
  const json = await res.json().catch(() => null)
  return {status: res.status, json}
}

/**
 * The server builds verification_uri from its own idea of its address, which
 * on a dev stack can be an internal hostname. Keep its path and query, and use
 * the host the plugin already talks to.
 */
function onApiHost(config: ResolvedConfig, uri: string): string {
  try {
    const u = new URL(uri, config.apiBase)
    return `${config.apiBase}${u.pathname}${u.search}`
  } catch {
    return uri
  }
}

export async function requestDeviceCode(config: ResolvedConfig): Promise<DeviceAuthorization> {
  if (!config.clientId) {
    throw new SignInError(
      'not_configured',
      'Sign-in is not set up for this FileSpin. Add its clientId to the plugin settings.',
    )
  }
  let result: {status: number; json: any}
  try {
    result = await postForm(config, '/oauth/device_authorization', {
      client_id: config.clientId,
      scope: SCOPES.join(' '),
    })
  } catch {
    throw new SignInError('server', 'FileSpin can’t be reached. Check your connection.')
  }
  const {status, json} = result
  if (status !== 200 || !json?.device_code) {
    throw new SignInError('server', `FileSpin couldn’t start sign-in (${json?.error || `HTTP ${status}`}).`)
  }
  return {
    ...json,
    verification_uri: onApiHost(config, json.verification_uri),
    verification_uri_complete: json.verification_uri_complete
      ? onApiHost(config, json.verification_uri_complete)
      : undefined,
  }
}

/** Polls until the user allows or denies in the other tab, or the code expires. */
export async function waitForApproval(
  config: ResolvedConfig,
  auth: DeviceAuthorization,
  signal: AbortSignal,
): Promise<TokenResponse> {
  let intervalMs = (auth.interval || 5) * 1000
  const deadline = Date.now() + (auth.expires_in || 600) * 1000
  while (Date.now() < deadline) {
    // Polling sooner than the interval only earns a slow_down.
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, intervalMs)
      signal.addEventListener('abort', () => {
        clearTimeout(t)
        resolve()
      })
    })
    if (signal.aborted) throw new SignInError('cancelled', 'Sign-in cancelled.')
    let result: {status: number; json: any}
    try {
      result = await postForm(config, '/oauth/token', {
        grant_type: GRANT_TYPE,
        client_id: config.clientId,
        device_code: auth.device_code,
      })
    } catch {
      continue // A dropped connection mid-wait is not a failed sign-in.
    }
    const {status, json} = result
    if (status === 200 && json?.access_token) return json
    switch (json?.error) {
      case 'authorization_pending':
        break
      case 'slow_down':
        intervalMs += 5000
        break
      case 'access_denied':
        throw new SignInError('denied', 'Access was declined on the FileSpin page.')
      case 'expired_token':
        throw new SignInError('expired', 'The sign-in code expired.')
      default:
        throw new SignInError('server', `FileSpin sign-in failed (${json?.error || `HTTP ${status}`}).`)
    }
  }
  throw new SignInError('expired', 'The sign-in code expired.')
}

/** Refresh, rotating the refresh token (FileSpin issues a new one every time). */
export async function refreshTokens(
  config: ResolvedConfig,
  refreshToken: string,
): Promise<TokenResponse | null> {
  const {status, json} = await postForm(config, '/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
  })
  return status === 200 && json?.access_token ? json : null
}

/** Best effort: tell FileSpin to forget the token on sign-out. */
export async function revoke(config: ResolvedConfig, token: string) {
  await postForm(config, '/oauth/revoke', {token, client_id: config.clientId}).catch(() => undefined)
}
