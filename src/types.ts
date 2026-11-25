/**
 * What a `filespin.asset` field stores. Everything a website needs to show
 * the asset without calling FileSpin's API: the CDN URL of the chosen
 * version, its size, and the asset id to build other sizes from (see
 * `sanity-plugin-filespin/url`).
 *
 * @public
 */
export interface FileSpinAssetValue {
  _type?: 'filespin.asset'
  /** FileSpin asset id (32 hex characters). */
  assetId: string
  /** File name in FileSpin. */
  name?: string
  kind: 'image' | 'video'
  /** MIME type of the original, e.g. "image/png". */
  contentType?: string
  /** Pixel size of the stored URL's file. */
  width?: number
  height?: number
  /** Bytes of the original. */
  size?: number
  /** Seconds, video only. */
  duration?: number
  /**
   * Which version is stored. Empty for the original image. An image format
   * (custom conversion) name, or a video version such as "720p-video.mp4".
   */
  variant?: string
  /** Ready to use: the image (largest FileSpin serves, 2048 x 1536) or the MP4. */
  url: string
  /** A still to show: the image itself, or a video's poster frame. */
  posterUrl?: string
  /** The CDN the URLs come from, e.g. "https://cdn.filespin.io". */
  cdn: string
  /** On-demand image version, so a replaced file gets fresh URLs. */
  version?: number
  /** Alternative text, written in Sanity. */
  alt?: string
}
