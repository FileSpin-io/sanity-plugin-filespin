/**
 * The Assets tab's Filters, as in FileSpin's Canva, Figma and WordPress apps:
 * file name, file type, upload date, generated assets, and a metadata schema
 * whose searchable fields then appear below it.
 */

import {IMAGE_TYPES} from '../config'
import type {AssetFilters, SchemaProperty, SchemaSummary} from '../api/types'

export interface Filters {
  fileName: string
  /** "", "image", "video", or one image type such as "image/svg+xml". */
  kind: string
  generatedOnly: boolean
  uploaded: string
  /** "YYYY-MM-DD", used when uploaded is "custom". */
  from?: string
  to?: string
  schemaId?: number
  /** A text, one pick-list value, several, or a "YYYY-MM-DD" day. */
  fields: Record<string, string | string[]>
}

export const NO_FILTERS: Filters = {fileName: '', kind: '', generatedOnly: false, uploaded: '', fields: {}}

/** One choice at a time, like the dashboard. Each image format is its own choice. */
export const KIND_OPTIONS = [
  {value: '', label: 'All'},
  {value: 'image', label: 'All images'},
  {value: 'image/jpeg', label: 'JPEG'},
  {value: 'image/png', label: 'PNG'},
  {value: 'image/gif', label: 'GIF'},
  {value: 'image/webp', label: 'WebP'},
  {value: 'image/heic', label: 'HEIC'},
  {value: 'image/svg+xml', label: 'SVG'},
  {value: 'video', label: 'Videos'},
]

/** File type choices that fit a field that takes only images or only videos. */
export function kindOptions(only?: 'image' | 'video') {
  if (only === 'image') return KIND_OPTIONS.filter((o) => o.value !== 'video')
  if (only === 'video') return KIND_OPTIONS.filter((o) => o.value === '')
  return KIND_OPTIONS
}

export const UPLOADED_OPTIONS = [
  {value: '', label: 'Any time'},
  {value: '7', label: 'Last 7 days'},
  {value: '30', label: 'Last 30 days'},
  {value: '365', label: 'Last 12 months'},
  {value: 'custom', label: 'Choose dates'},
]

export const SORT_OPTIONS = [
  {value: 'newest', label: 'Newest'},
  {value: 'oldest', label: 'Oldest'},
  {value: 'name', label: 'Name A–Z'},
  {value: 'size', label: 'Largest'},
]

export type Widget = 'text' | 'select' | 'multiselect' | 'date'

export interface SearchField {
  name: string
  label: string
  widget: Widget
  options: string[]
}

/** Localised strings come back as {"en": "..."} maps, not strings. */
export function localised(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const map = value as Record<string, string>
  return map.en || Object.values(map)[0] || ''
}

/** "in_review" -> "In review" */
export function humanise(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function widgetOf(def: SchemaProperty): Widget {
  const values = def.enum || def.items?.enum
  if (values?.length) return def.type === 'array' ? 'multiselect' : 'select'
  if (def.format === 'date' || def.format === 'date-time') return 'date'
  return 'text'
}

/** The fields the dashboard offers for a schema: searchable, not hidden, in the schema's order. */
export function searchFieldsOf(schema?: SchemaSummary): SearchField[] {
  return Object.entries(schema?.schema?.properties || {})
    .filter(([, def]) => def.filespin_properties?.searchable && !def.filespin_properties.ui?.hidden)
    .map(([name, def]) => ({
      name,
      label: localised(def.filespin_properties?.title) || humanise(name),
      widget: widgetOf(def),
      options: (def.enum || def.items?.enum || []).map(String),
      order: def.filespin_properties?.ui?.order ?? 9999,
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({order: _order, ...field}) => field)
}

const day = (iso: string, endOfDay: boolean) => `${iso}T${endOfDay ? '23:59:59' : '00:00:00'}Z`

/** How many filters are on, for the Filters button. */
export function activeCount(f: Filters): number {
  const fields = Object.values(f.fields).filter((v) => (Array.isArray(v) ? v.length : v.trim())).length
  return (
    (f.fileName.trim() ? 1 : 0) +
    (f.kind ? 1 : 0) +
    (f.generatedOnly ? 1 : 0) +
    (f.uploaded ? 1 : 0) +
    (f.schemaId != null ? 1 : 0) +
    fields
  )
}

/** The screen's choices -> the search API's terms. `only` keeps a locked field's kind. */
export function toAssetFilters(f: Filters, schemas: SchemaSummary[], only?: 'image' | 'video'): AssetFilters {
  const out: AssetFilters = {}
  if (f.fileName.trim()) out.fileName = f.fileName.trim()
  if (f.kind === 'image') out.contentTypes = [...IMAGE_TYPES]
  else if (f.kind === 'video') out.contentTypes = ['video*']
  else if (f.kind) out.contentTypes = [f.kind]
  else if (only === 'image') out.contentTypes = [...IMAGE_TYPES]
  else if (only === 'video') out.contentTypes = ['video*']
  if (f.generatedOnly) out.generatedOnly = true

  if (f.uploaded === 'custom') {
    if (f.from) out.uploadedAfter = day(f.from, false)
    if (f.to) out.uploadedBefore = day(f.to, true)
  } else if (f.uploaded) {
    out.uploadedAfter = new Date(Date.now() - Number(f.uploaded) * 86_400_000).toISOString()
  }

  if (f.schemaId != null) {
    out.schemaId = f.schemaId
    const widgets = Object.fromEntries(
      searchFieldsOf(schemas.find((s) => s.id === f.schemaId)).map((x) => [x.name, x.widget]),
    )
    out.fields = {}
    for (const [name, value] of Object.entries(f.fields)) {
      const widget = widgets[name]
      if (!widget) continue
      if (Array.isArray(value)) {
        // A list is a range to the search API, so values are ORed in a string.
        if (value.length) out.fields[name] = value.join(' OR ')
      } else if (value.trim()) {
        out.fields[name] = widget === 'date' ? [day(value, false), day(value, true)] : value.trim()
      }
    }
  }
  return out
}
