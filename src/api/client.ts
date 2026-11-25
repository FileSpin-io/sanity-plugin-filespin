/**
 * The FileSpin API calls the plugin makes. Shapes and quirks are the ones the
 * Canva and Figma apps verified against the live API. Read-only: the plugin
 * never changes the library.
 *
 * Every call runs in the editor's browser. FileSpin's nginx echoes any
 * Origin, so CORS allows any Studio address.
 */

import {LISTED_TYPES, type ResolvedConfig} from '../config'
import type {SessionStore} from '../auth/session'
import type {AssetFilters, FileSpinAsset, FileSpinCollection, Page, SchemaSummary} from './types'

/** The login is gone: no token, or the refresh was refused. */
export class NotAuthorizedError extends Error {}
/** A valid login that may not do this (403 with a fresh token). */
export class ForbiddenError extends Error {}
/** A saved search result the server no longer keeps (410 on a page turn). */
export class SearchExpiredError extends Error {}
/** Any other failed call; `status` 0 means the network. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

const RETRYABLE = new Set([429, 502, 503, 504])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const PAGE_SIZE = 30

type SearchResponse = {
  result?: string[]
  extended_result?: Record<string, FileSpinAsset>
  page?: number
  total_pages?: number
  total_files?: number
  search_result_id: string
}

function shapeSearch(body: SearchResponse, fallbackPage: number): Page<FileSpinAsset> {
  const extended = body.extended_result || {}
  // `result` keeps the order; extended_result is an unordered map.
  return {
    items: (body.result || []).map((id) => extended[id] || {id}),
    page: body.page || fallbackPage,
    totalPages: body.total_pages || 1,
    total: body.total_files || 0,
    sid: body.search_result_id,
  }
}

/** The Assets tab's sort choices, as the search API names them. */
export const SORTS: Record<string, string> = {
  newest: 'upload_time_range_DESC',
  oldest: 'upload_time_range_ASC',
  name: 'file_name_ASC',
  size: 'file_size_range_DESC',
}

export class FileSpinClient {
  constructor(
    readonly config: ResolvedConfig,
    private readonly session: SessionStore,
  ) {}

  private url(path: string) {
    return /^https?:\/\//.test(path) ? path : `${this.config.apiBase}${path}`
  }

  /**
   * A rejected token is 401 on newer handlers (collections) but 403 on the
   * older ones (search, get_link), so 403 alone cannot tell "login expired"
   * from "you cannot see this". On either, refresh and retry once: a refused
   * refresh ends the login; a fresh token still refused is a real denial.
   */
  private async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const send = async (token: string | null) => {
      if (!token) throw new NotAuthorizedError('not signed in')
      try {
        return await fetch(this.url(path), {
          ...init,
          headers: {...(init.headers as Record<string, string>), Authorization: `Bearer ${token}`},
        })
      } catch {
        throw new ApiError('FileSpin can’t be reached. Check your connection.', 0)
      }
    }
    // Every call here reads, so a busy server earns one retry.
    let res = await send(await this.session.accessToken())
    if (RETRYABLE.has(res.status)) {
      await sleep(1000)
      res = await send(await this.session.accessToken())
    }
    if (res.status === 401 || res.status === 403) {
      const s = await this.session.forceRefresh()
      res = await send(s?.accessToken ?? null)
      if (res.status === 401) {
        await this.session.signOut()
        throw new NotAuthorizedError('token rejected after refresh')
      }
      if (res.status === 403) throw new ForbiddenError('Your FileSpin account can’t see this.')
    }
    if (res.status === 410) throw new SearchExpiredError(path)
    if (!res.ok) throw new ApiError(`FileSpin answered HTTP ${res.status}. Try again.`, res.status)
    return res
  }

  private post(path: string, body: unknown) {
    return this.fetch(path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    })
  }

  /**
   * POST /api/v1/assets/search, first page. The body is a strict model that
   * rejects unknown fields, so paging is the separate GET below.
   * `content_type` takes "a OR b" exact types, so only usable types come back
   * and pages stay full. The schema filter goes as the dashboard sends it.
   */
  async search(opts: {
    keyword?: string
    sort?: string
    filters?: AssetFilters
    types?: readonly string[]
  }): Promise<Page<FileSpinAsset>> {
    const f = opts.filters || {}
    const body: Record<string, unknown> = {
      keyword: opts.keyword || '',
      content_type: (f.contentTypes?.length ? f.contentTypes : opts.types || LISTED_TYPES).join(' OR '),
      status: 'OK',
      limit_per_page: PAGE_SIZE,
      extended_result: true,
    }
    if (opts.sort) body.sort_by = [SORTS[opts.sort] || opts.sort]
    if (f.fileName) body.file_name = f.fileName
    if (f.uploadedAfter || f.uploadedBefore) {
      body.upload_time_range = {
        start: f.uploadedAfter || '1970-01-01T00:00:00Z',
        end: f.uploadedBefore || new Date().toISOString(),
      }
    }
    // "Generated" is a marker field matched in any schema, so without a chosen
    // schema the search must not require one (as the dashboard does).
    const fields: Record<string, unknown> = {...f.fields}
    if (f.generatedOnly) fields._filespin_original_asset_id = '*'
    if (f.schemaId != null || f.generatedOnly) {
      body.schema_criteria = {...(f.schemaId != null ? {data_schema_id: f.schemaId} : {}), fields}
    }
    if (f.generatedOnly && f.schemaId == null) body.require_schema_id = false
    const res = await this.post('/api/v1/assets/search', body)
    return shapeSearch(await res.json(), 1)
  }

  /**
   * GET /api/v1/assets/search/{id}/{page}. The server keeps a result for an
   * hour, then answers 410. Never from the browser cache: the same search gets
   * the same id, and a cached 410 would outlive the search being run again.
   */
  async searchPage(sid: string, page: number): Promise<Page<FileSpinAsset>> {
    const res = await this.fetch(`/api/v1/assets/search/${sid}/${page}`, {cache: 'no-store'})
    return shapeSearch(await res.json(), page)
  }

  /** POST /api/v1/collections: POST because only it honours `sort_by`. */
  async collections(opts: {keyword?: string; page: number}): Promise<Page<FileSpinCollection>> {
    const res = await this.post('/api/v1/collections', {
      keyword: opts.keyword || undefined,
      // Collections list A to Z, as in the Figma app (this endpoint's own sort names).
      sort_by: ['name ASC'],
      limit: PAGE_SIZE,
      offset: (opts.page - 1) * PAGE_SIZE,
    })
    const {data} = await res.json()
    const total: number = data?.total_collections || 0
    return {
      items: data?.collections || [],
      page: opts.page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      total,
    }
  }

  /**
   * POST /api/v1/collection/{id}/search. This endpoint takes one content type,
   * not "a OR b", so it is asked for everything and the rest is dropped here;
   * paging stays on the server's offsets, so a page may come back short.
   */
  async collectionAssets(
    id: number,
    opts: {keyword?: string; page: number; kinds: readonly ('image' | 'video')[]},
  ): Promise<Page<FileSpinAsset>> {
    const res = await this.post(`/api/v1/collection/${id}/search`, {
      keyword: opts.keyword || undefined,
      sort_by: 'upload_time:desc',
      limit: PAGE_SIZE,
      offset: (opts.page - 1) * PAGE_SIZE,
    })
    const {data} = await res.json()
    const extended: Record<string, FileSpinAsset> = data?.extended_result || {}
    const ids: string[] = data?.matching_assets || []
    const total: number = data?.total || 0
    const listed = new RegExp(`^(${opts.kinds.join('|')})/`)
    return {
      items: ids
        .map((assetId): FileSpinAsset => extended[assetId] || {id: assetId})
        .filter((a) => listed.test(a.content_type || '') && (a.status || 'OK') === 'OK'),
      page: opts.page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      total,
    }
  }

  /** GET /api/v1/assets/{id}/data: everything about one asset, conversions included. */
  async asset(id: string): Promise<FileSpinAsset> {
    const res = await this.fetch(`/api/v1/assets/${id}/data`)
    return res.json()
  }

  /**
   * A signed link (one hour) to the original or a conversion (`key=720p-video`)
   * on the deployment's own CDN. Used only to copy a file into Sanity.
   */
  async fileLink(id: string, key = 'original'): Promise<string> {
    const res = await this.fetch(
      `/api/v1/assets/${id}/get_link?key=${encodeURIComponent(key)}&delivery=download&expiry=3600&cdn=default`,
    )
    const link = (await res.text()).trim()
    if (!/^https:\/\//.test(link)) throw new ApiError('FileSpin returned no link for this file.', res.status)
    return link
  }

  /** GET /oauth/userinfo: who is signed in, for the account menu. */
  async userinfo(): Promise<{email?: string; name?: string}> {
    const res = await this.fetch('/oauth/userinfo')
    return res.json()
  }

  /** GET /api/v1/assetschemas: the account's active metadata schemas. */
  async schemas(): Promise<SchemaSummary[]> {
    const res = await this.fetch('/api/v1/assetschemas?status=ACTIVE')
    const body = await res.json()
    return body.data || body || []
  }
}
