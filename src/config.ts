/**
 * Which FileSpin the plugin talks to, and the addresses that go with it.
 *
 * The SaaS (app.filespin.io) is the default. `host` points a Studio at another
 * FileSpin environment; an environment the plugin does not know needs its own
 * public OAuth2 client (`clientId`) and CDN (`cdnHost`).
 */

/** @public */
export interface FileSpinPluginConfig {
  /** FileSpin API address. Default `https://app.filespin.io`. */
  host?: string
  /** Public OAuth2 client for that FileSpin. Known hosts have one built in. */
  clientId?: string
  /** CDN that serves the stored URLs. Known hosts have one built in. */
  cdnHost?: string
  /**
   * Add FileSpin to Sanity's own image and file pickers (copies the file into
   * Sanity). Default true. The `filespin.asset` field type is always added.
   */
  assetSource?: boolean
}

export interface ResolvedConfig {
  apiBase: string
  cdnBase: string
  clientId: string
  dashboardBase: string
  signupUrl: string
  assetSource: boolean
}

type Known = {cdn: string; clientId: string; dashboard: string}

const SAAS = 'https://app.filespin.io'

/**
 * The "FileSpin for Sanity" public OAuth2 client (`oauth2_client.is_public = 1`,
 * no secret, scope read_assets). Same id on every environment, as the Adobe,
 * Figma and WordPress plugins do, so one build serves them all.
 */
const CLIENT_ID = '5a077d70b1e446fbae39df70e83f6234'

const KNOWN: Record<string, Known> = {
  [SAAS]: {cdn: 'https://cdn.filespin.io', clientId: CLIENT_ID, dashboard: 'https://dashboard.filespin.io'},
  'https://appdev.filespin.io': {
    cdn: 'https://devcdn.filespin.io',
    clientId: CLIENT_ID,
    dashboard: 'https://dev--filespin-ui.netlify.app',
  },
}

const trim = (u: string) => u.trim().replace(/\/+$/, '')

export function resolveConfig(config: FileSpinPluginConfig = {}): ResolvedConfig {
  const apiBase = trim(config.host || SAAS)
  const known = KNOWN[apiBase]
  const dashboardBase = known?.dashboard || KNOWN[SAAS].dashboard
  return {
    apiBase,
    cdnBase: trim(config.cdnHost || known?.cdn || apiBase),
    clientId: config.clientId || known?.clientId || '',
    dashboardBase,
    // Tagged so sign-ups that come from Sanity can be counted.
    signupUrl: `${dashboardBase}/signup?utm_source=sanity&utm_medium=referral&utm_campaign=plugins`,
    assetSource: config.assetSource !== false,
  }
}

/** Only scope the plugin needs: it reads the library, it never changes it. */
export const SCOPES = ['read_assets']

/** Image types the plugin lists. Audio and documents never list. */
export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/svg+xml',
] as const

/** The search API ORs these; "video*" matches every video type. */
export const LISTED_TYPES = [...IMAGE_TYPES, 'video*'] as const

/** FileSpin's resized copies stop at 2048 x 1536 (filespin/common/odi_limits.py). */
export const ODI_MAX_W = 2048
export const ODI_MAX_H = 1536

/** One thumbnail size everywhere, so the CDN and browser caches are reused. */
export const THUMBNAIL_SIZE = 240
