export interface FileSpinAsset {
  id: string
  name?: string
  content_type?: string
  size?: number
  status?: string
  update_time?: string
  upload_time?: string
  /** `duration` (seconds) only for video. */
  metadata?: {width?: number; height?: number; duration?: number}
  data?: Record<string, unknown>
  data_schema_id?: number
  conversions?: Record<string, FileSpinConversion>
  addons_info?: Record<string, {available?: boolean; version?: number | string} | undefined>
}

export interface FileSpinConversion {
  key?: string
  content_type?: string
  width?: number
  height?: number
  size?: number
  public?: boolean
}

export interface FileSpinCollection {
  id: number
  name: string
  description?: string
  last_update?: string
  assets?: string[]
}

/** What the Filters screen narrows a search to, in the API's terms. */
export interface AssetFilters {
  fileName?: string
  contentTypes?: string[]
  generatedOnly?: boolean
  uploadedAfter?: string
  uploadedBefore?: string
  schemaId?: number
  /** A string is matched as typed ("a OR b" for several values); a pair is a date range. */
  fields?: Record<string, string | [string, string]>
}

/** One page of results, whatever list it came from. */
export interface Page<T> {
  items: T[]
  page: number
  totalPages: number
  total: number
  /** The search's id, used to fetch its later pages. */
  sid?: string
}

export interface SchemaProperty {
  type?: string
  format?: string
  enum?: string[]
  items?: {enum?: string[]}
  filespin_properties?: {
    searchable?: boolean
    title?: unknown
    ui?: {hidden?: boolean; order?: number}
  }
}

export interface SchemaSummary {
  id: number
  name: unknown
  schema?: {properties?: Record<string, SchemaProperty>}
}
