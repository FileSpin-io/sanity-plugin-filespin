/**
 * Build FileSpin CDN URLs on your website from a stored `filespin.asset`.
 * No dependencies, safe to import in any frontend:
 *
 * ```ts
 * import {filespinImageUrl} from 'sanity-plugin-filespin/url'
 *
 * filespinImageUrl(post.hero, {width: 800})                    // fits inside 800 wide
 * filespinImageUrl(post.hero, {width: 400, height: 400, crop: 'face'})
 * ```
 *
 * Images come from FileSpin's on-demand imaging: any size up to 2048 x 1536,
 * and the CDN picks AVIF or WebP for browsers that take them unless `format`
 * is set. Docs: https://developers.filespin.io/
 */

import type {FileSpinAssetValue} from './types'

/** @public */
export type CropAlign = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'face'

/** @public */
export interface ImageUrlOptions {
  /** Fit inside this width (px). */
  width?: number
  /** Fit inside this height (px). */
  height?: number
  /** Fill exactly width x height, cutting the rest; aligned to this side (or a face). */
  crop?: CropAlign | boolean
  /** Fix the file format instead of letting the CDN choose. */
  format?: 'jpg' | 'png' | 'webp' | 'avif' | 'gif'
  /** 1-100, for lossy formats. */
  quality?: number
  /** Fill transparent areas, e.g. "ffffff" (useful with format "jpg"). */
  bgcolor?: string
}

/** FileSpin's resized copies stop at this size. */
export const MAX_WIDTH = 2048
export const MAX_HEIGHT = 1536

/** @public */
export type FileSpinAssetRef = Pick<FileSpinAssetValue, 'assetId' | 'cdn' | 'kind'> &
  Partial<
    Pick<FileSpinAssetValue, 'variant' | 'version' | 'width' | 'height' | 'url' | 'posterUrl'>
  >

const clamp = (n: number | undefined, max: number) =>
  n && n > 0 ? Math.min(Math.round(n), max) : 0

/** The on-demand image URL for an asset id, optionally an image format of it. */
export function odiUrl(
  cdn: string,
  assetId: string,
  params: Record<string, string | number | undefined>,
  conversion?: string,
): string {
  const base = `${cdn.replace(/\/+$/, '')}/api/v1/assets/${encodeURIComponent(assetId)}/conversions${
    conversion ? `/${encodeURIComponent(conversion)}` : ''
  }`
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    // Commas stay literal: resize=W,H and crop=W,H,align.
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v)).replace(/%2C/g, ',')}`,
    )
    .join('&')
  return query ? `${base}?${query}` : base
}

/**
 * An image URL at the size you ask for. For a video, its poster frame.
 * Without width and height, the stored URL (largest size FileSpin serves).
 *
 * @public
 */
export function filespinImageUrl(asset: FileSpinAssetRef, options: ImageUrlOptions = {}): string {
  const {width, height, crop, format, quality, bgcolor} = options
  if (!width && !height && !format && !quality && !bgcolor) {
    if (asset.kind === 'image' && asset.url) return asset.url
    if (asset.kind === 'video' && asset.posterUrl) return asset.posterUrl
  }
  const w = clamp(width, MAX_WIDTH)
  const h = clamp(height, MAX_HEIGHT)
  const params: Record<string, string | number | undefined> = {}
  if (crop && w && h) params.crop = `${w},${h},${crop === true ? 'center' : crop}`
  else params.resize = `${w || MAX_WIDTH},${h || MAX_HEIGHT}`
  params.format = format
  params.quality = quality
  params.bgcolor = bgcolor
  params.v = asset.version || undefined
  // A video's image formats are not stills, so its poster is always from the original.
  const conversion = asset.kind === 'image' ? asset.variant : undefined
  return odiUrl(asset.cdn, asset.assetId, params, conversion)
}

/**
 * `srcset` for an image: one URL per width, each fitting inside that width.
 *
 * @public
 */
export function filespinSrcSet(
  asset: FileSpinAssetRef,
  widths: number[] = [320, 640, 960, 1280, 1600, 2048],
  options: Omit<ImageUrlOptions, 'width' | 'height' | 'crop'> = {},
): string {
  // Never wider than the file itself, but always up to its full width.
  const full = asset.width ? Math.min(asset.width, MAX_WIDTH) : 0
  const list = full ? [...widths.filter((w) => w < full), full] : widths
  return list.map((w) => `${filespinImageUrl(asset, {...options, width: w})} ${w}w`).join(', ')
}

/**
 * A video's MP4 URL: the stored version, or another public version of it by
 * name, e.g. "480p-video".
 *
 * @public
 */
export function filespinVideoUrl(asset: FileSpinAssetRef, version?: string): string {
  if (!version && asset.url) return asset.url
  const file = version
    ? version.endsWith('.mp4')
      ? version
      : `${version}.mp4`
    : asset.variant || ''
  return transcodeUrl(asset.cdn, asset.assetId, file)
}

/** A public video version on the CDN: its name plus ".mp4" (not its storage key). */
export function transcodeUrl(cdn: string, assetId: string, file: string): string {
  return `${cdn.replace(/\/+$/, '')}/api/v1/assets/${encodeURIComponent(assetId)}/transcodes/${encodeURIComponent(file)}`
}
