/**
 * From FileSpin asset data to what the panel shows and the field stores.
 * The rules are the WordPress plugin's, checked against appdev:
 *  - images: on-demand image URLs on the CDN, at most 2048 x 1536;
 *  - an image's formats (custom conversions): only public ones work on a
 *    website, the CDN answers 403 for the others;
 *  - videos: public MP4 versions at `transcodes/{name}.mp4` (the storage
 *    key's file name is a 404 on the CDN).
 */

import {ODI_MAX_H, ODI_MAX_W, THUMBNAIL_SIZE, type ResolvedConfig} from '../config'
import type {FileSpinAsset} from '../api/types'
import type {FileSpinAssetValue} from '../types'
import {odiUrl, transcodeUrl} from '../url'

export const kindOf = (a: Pick<FileSpinAsset, 'content_type'>): 'image' | 'video' | 'other' =>
  a.content_type?.startsWith('image/') ? 'image' : a.content_type?.startsWith('video/') ? 'video' : 'other'

/** On-demand image version, so a replaced file gets new URLs. */
export function odiVersion(a: FileSpinAsset): number | undefined {
  const v = Number(a.addons_info?.ON_DEMAND_IMAGE?.version)
  return v > 0 ? v : undefined
}

/** Same size everywhere in the panel, so the browser reuses it. */
export function thumbnailUrl(config: ResolvedConfig, a: FileSpinAsset, size = THUMBNAIL_SIZE): string {
  return odiUrl(config.cdnBase, a.id, {
    resize: `${size},${size}`,
    v: odiVersion(a) || (a.update_time ? Date.parse(a.update_time) / 1000 || undefined : undefined),
  })
}

/** Largest size inside both the file and FileSpin's resize limit. */
export function fitDims(width?: number, height?: number): [number, number] {
  if (!width || !height) return [0, 0]
  const scale = Math.min(1, ODI_MAX_W / width, ODI_MAX_H / height)
  return [Math.round(width * scale), Math.round(height * scale)]
}

export interface ImageFormat {
  name: string
  width: number
  height: number
  size: number
  public: boolean
}

/** An image's formats, as the dashboard's Formats tab lists them. */
export function imageFormats(a: FileSpinAsset): ImageFormat[] {
  return Object.entries(a.conversions || {})
    .filter(([name, c]) => /^[a-z0-9_-]+$/i.test(name) && (c?.content_type || '').startsWith('image/'))
    .map(([name, c]) => ({
      name,
      width: c.width || 0,
      height: c.height || 0,
      size: c.size || 0,
      public: !!c.public,
    }))
    .sort((x, y) => x.name.localeCompare(y.name))
}

export interface VideoVersion {
  /** e.g. "720p-video.mp4" */
  file: string
  label: string
  width: number
  height: number
  size: number
  watermarked: boolean
}

/** A video's playable web versions: public MP4s, sharpest unwatermarked first. */
export function videoVersions(a: FileSpinAsset): VideoVersion[] {
  return Object.entries(a.conversions || {})
    .filter(
      ([name, c]) =>
        /^[a-z0-9_-]+$/i.test(name) &&
        name !== 'clip_preview' && // a preview clip is not the video itself
        !!c?.public &&
        (c.key || '').toLowerCase().endsWith('.mp4'),
    )
    .map(([name, c]) => {
      const watermarked = name.includes('-wm-')
      const res = /^(\d+p)/.exec(name)?.[1] || name
      return {
        file: `${name}.mp4`,
        label: watermarked ? `${res}, watermarked` : res,
        width: c.width || 0,
        height: c.height || 0,
        size: c.size || 0,
        watermarked,
      }
    })
    .sort((x, y) => Number(x.watermarked) - Number(y.watermarked) || y.height - x.height)
}

/** 1080p, else 720p, else 480p, else the sharpest unwatermarked version. */
export function bestVersion(versions: VideoVersion[]): VideoVersion | undefined {
  for (const name of ['1080p-video', '720p-video', '480p-video']) {
    const hit = versions.find((v) => v.file === `${name}.mp4`)
    if (hit) return hit
  }
  return versions.find((v) => !v.watermarked) || versions[0]
}

/**
 * The field's value for an asset and a chosen version ('' = original image,
 * or the best video version). Needs the full asset data (`/data`).
 */
export function toValue(
  config: ResolvedConfig,
  a: FileSpinAsset,
  variant = '',
): FileSpinAssetValue | {error: string} {
  const kind = kindOf(a)
  const version = odiVersion(a)
  const base = {
    _type: 'filespin.asset' as const,
    assetId: a.id,
    name: a.name,
    contentType: a.content_type,
    size: a.size,
    cdn: config.cdnBase,
    ...(version ? {version} : {}),
  }
  if (kind === 'image') {
    const format = variant ? imageFormats(a).find((f) => f.name === variant) : undefined
    if (variant && !format) return {error: 'That format no longer exists in FileSpin.'}
    if (format && !format.public) {
      return {error: 'This format is private in FileSpin, so a website can’t show it. Make it public in FileSpin first.'}
    }
    const [w, h] = format ? fitDims(format.width, format.height) : fitDims(a.metadata?.width, a.metadata?.height)
    const url = odiUrl(config.cdnBase, a.id, {resize: `${w || ODI_MAX_W},${h || ODI_MAX_H}`, v: version}, variant || undefined)
    return {
      ...base,
      kind,
      ...(w ? {width: w, height: h} : {}),
      ...(variant ? {variant} : {}),
      url,
      posterUrl: url,
    }
  }
  if (kind === 'video') {
    const versions = videoVersions(a)
    const chosen = variant ? versions.find((v) => v.file === variant) : bestVersion(versions)
    if (!chosen) {
      return {
        error:
          'This video has no public web version yet. In FileSpin, make a transcode (such as 720p) public, then try again.',
      }
    }
    return {
      ...base,
      kind,
      ...(chosen.width ? {width: chosen.width, height: chosen.height} : {}),
      ...(a.metadata?.duration ? {duration: a.metadata.duration} : {}),
      variant: chosen.file,
      url: transcodeUrl(config.cdnBase, a.id, chosen.file),
      posterUrl: odiUrl(config.cdnBase, a.id, {resize: '1280,1280', v: version}),
    }
  }
  return {error: 'Only images and videos can be added from FileSpin.'}
}

export function formatBytes(n?: number): string {
  if (!n) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

export function formatDuration(s?: number): string {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** "image/svg+xml" -> "SVG" */
export function typeLabel(contentType?: string): string {
  const sub = (contentType || '').split('/')[1] || ''
  return sub.replace(/\+xml$/, '').replace(/^x-/, '').toUpperCase()
}

export function dashboardAssetUrl(config: ResolvedConfig, assetId: string) {
  return `${config.dashboardBase}/asset/${assetId}`
}
