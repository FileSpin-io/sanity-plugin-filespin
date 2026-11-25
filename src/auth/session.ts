/**
 * The signed-in FileSpin login, one per Sanity user per browser, kept in
 * localStorage. Each editor signs in with their own FileSpin account, so
 * FileSpin's own permissions decide what each of them sees. Nothing is stored
 * in the Sanity dataset, so no token ends up in a dataset export.
 *
 * FileSpin rotates the refresh token on every refresh, so two refreshes at
 * once (two Studio tabs) would leave one holding a dead token. Refreshes are
 * serialised with the Web Locks API across tabs, and a tab first re-reads
 * storage in case another tab already refreshed.
 */

import type {ResolvedConfig} from '../config'
import {refreshTokens, revoke, type TokenResponse} from './deviceFlow'

export interface Session {
  host: string
  accessToken: string
  refreshToken: string
  /** ms since epoch */
  expiresAt: number
  email?: string
}

type Listener = (s: Session | null) => void

function isSession(x: unknown): x is Session {
  return (
    typeof x === 'object' &&
    x !== null &&
    'host' in x &&
    typeof x.host === 'string' &&
    'accessToken' in x &&
    typeof x.accessToken === 'string' &&
    'refreshToken' in x &&
    typeof x.refreshToken === 'string' &&
    'expiresAt' in x &&
    typeof x.expiresAt === 'number'
  )
}

function read(key: string): Session | null {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

function write(key: string, s: Session | null) {
  try {
    if (s) window.localStorage.setItem(key, JSON.stringify(s))
    else window.localStorage.removeItem(key)
  } catch {
    // Storage blocked (private window): the login lasts for this page only.
  }
}

export class SessionStore {
  private current: Session | null
  private refreshing: Promise<Session | null> | null = null
  private listeners = new Set<Listener>()

  constructor(
    private readonly config: ResolvedConfig,
    private readonly key: string,
  ) {
    const saved = read(key)
    this.current = saved && saved.host === config.apiBase ? saved : null
  }

  get(): Session | null {
    return this.current
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    // Another tab signing in or out shows up here too.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== this.key) return
      const s = read(this.key)
      this.current = s && s.host === this.config.apiBase ? s : null
      l(this.current)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      this.listeners.delete(l)
      window.removeEventListener('storage', onStorage)
    }
  }

  private set(s: Session | null) {
    this.current = s
    write(this.key, s)
    this.listeners.forEach((l) => l(s))
  }

  saveTokens(t: TokenResponse, email?: string): Session {
    const s: Session = {
      host: this.config.apiBase,
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + (t.expires_in || 3600) * 1000,
      email: email ?? this.current?.email,
    }
    this.set(s)
    return s
  }

  setEmail(email: string) {
    if (this.current && this.current.email !== email) this.set({...this.current, email})
  }

  async signOut() {
    const s = this.current
    this.set(null)
    if (s) await revoke(this.config, s.refreshToken)
  }

  /** Refresh now. Refused by the server = the login is over. */
  forceRefresh(): Promise<Session | null> {
    if (!this.current) return Promise.resolve(null)
    if (!this.refreshing) {
      const stale = this.current.refreshToken
      const run = async (): Promise<Session | null> => {
        // Another tab may have refreshed while we waited for the lock.
        const stored = read(this.key)
        if (stored && stored.host === this.config.apiBase && stored.refreshToken !== stale) {
          this.current = stored
          return stored
        }
        try {
          const t = await refreshTokens(this.config, stale)
          if (t) return this.saveTokens(t)
          this.set(null)
          return null
        } catch {
          // A network error is not a refused refresh: keep the login.
          return this.current
        }
      }
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
      const p = locks ? locks.request(`${this.key}:refresh`, run) : run()
      this.refreshing = p.finally(() => {
        this.refreshing = null
      })
    }
    return this.refreshing
  }

  async accessToken(): Promise<string | null> {
    if (!this.current) return null
    if (this.current.expiresAt - Date.now() < 60_000) {
      const s = await this.forceRefresh()
      return s?.accessToken ?? null
    }
    return this.current.accessToken
  }
}

const stores = new Map<string, SessionStore>()

/** One store per FileSpin + Sanity project + Sanity user, shared by every field. */
export function sessionStore(
  config: ResolvedConfig,
  projectId: string,
  userId: string,
): SessionStore {
  const key = `filespin:session:${config.apiBase}:${projectId}:${userId}`
  let s = stores.get(key)
  if (!s) {
    s = new SessionStore(config, key)
    stores.set(key, s)
  }
  return s
}
