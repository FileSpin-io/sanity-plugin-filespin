/**
 * One asset: a bigger preview (a video plays), its facts, which version to
 * use (an image's formats or a video's web versions), and its metadata.
 */

import {ArrowLeftIcon} from '@sanity/icons/ArrowLeft'
import {LaunchIcon} from '@sanity/icons/Launch'
import {Box, Button, Card, Flex, Grid, Select, Spinner, Stack, Text} from '@sanity/ui'
import {useEffect, useMemo, useState} from 'react'
import {styled} from 'styled-components'

import type {FileSpinAsset} from '../api/types'
import {humanise} from '../lib/filters'
import {
  bestVersion,
  dashboardAssetUrl,
  formatBytes,
  formatDuration,
  hasHls,
  imageFormats,
  kindOf,
  odiVersion,
  thumbnailUrl,
  typeLabel,
  videoVersions,
} from '../lib/media'
import {odiUrl, transcodeUrl} from '../url'
import {useFileSpin} from './FileSpinProvider'

const Preview = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-muted-bg-color, var(--card-bg2-color));
  border-radius: 3px;
  min-height: 200px;
  max-height: 360px;
  overflow: hidden;
  & > img,
  & > video {
    max-width: 100%;
    max-height: 360px;
    display: block;
  }
`

function Fact({label, value}: {label: string; value?: string | number}) {
  if (value === undefined || value === '') return null
  return (
    <Stack gap={2}>
      <Text size={0} muted weight="medium">
        {label}
      </Text>
      <Text size={1}>{value}</Text>
    </Stack>
  )
}

function show(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(show).join(', ')
  if (v && typeof v === 'object') return JSON.stringify(v)
  return ''
}

export function DetailsView(props: {
  asset: FileSpinAsset
  /** Copy mode can use private formats (it copies through a signed link); a CDN link can't. */
  allowPrivate: boolean
  busy: boolean
  pickLabel: string
  onPick: (a: FileSpinAsset, variant: string) => void
  onBack: () => void
}) {
  const {client, config} = useFileSpin()
  const [full, setFull] = useState<FileSpinAsset | null>(null)
  const [error, setError] = useState('')
  const [variant, setVariant] = useState('')
  const kind = kindOf(props.asset)

  // The parent keys this screen by asset id, so state starts fresh per asset.
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const a = await client.asset(props.asset.id)
        if (!live) return
        setFull(a)
        if (kindOf(a) === 'video') setVariant(bestVersion(videoVersions(a))?.file || '')
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'FileSpin could not be reached.')
      }
    })()
    return () => {
      live = false
    }
  }, [client, props.asset.id])

  const a = full || props.asset
  const formats = useMemo(() => (full ? imageFormats(full) : []), [full])
  const versions = useMemo(() => (full ? videoVersions(full) : []), [full])
  // The smallest web version plays fastest in the preview.
  const previewVideo = versions.length
    ? [...versions].sort((x, y) => x.height - y.height)[0]
    : undefined
  const chosenFormat = formats.find((f) => f.name === variant)
  const chosenVersion = versions.find((v) => v.file === variant)
  const stream = !props.allowPrivate && full !== null && hasHls(full)

  // The preview follows the choice: a format's own image, a video's chosen version.
  // A private format (copy mode only) has no public URL, so it shows through a signed link.
  const [privatePreview, setPrivatePreview] = useState<{name: string; url: string} | null>(null)
  useEffect(() => {
    if (!full || !chosenFormat || chosenFormat.public) return undefined
    let live = true
    client
      .fileLink(full.id, chosenFormat.name)
      .then((url) => live && setPrivatePreview({name: chosenFormat.name, url}))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [client, full, chosenFormat])
  const previewImage = !chosenFormat
    ? thumbnailUrl(config, a, 480)
    : chosenFormat.public
      ? odiUrl(
          config.cdnBase,
          a.id,
          {resize: '480,480', v: full ? odiVersion(full) : undefined},
          chosenFormat.name,
        )
      : privatePreview?.name === chosenFormat.name
        ? privatePreview.url
        : thumbnailUrl(config, a, 480)
  const shownVideo = chosenVersion || previewVideo
  const blocked =
    !props.allowPrivate &&
    ((kind === 'image' && chosenFormat !== undefined && !chosenFormat.public) ||
      (kind === 'video' && versions.length === 0))

  const metadata = Object.entries(a.data || {}).filter(
    ([k, v]) => !k.startsWith('_') && show(v) !== '',
  )

  return (
    <Stack gap={4}>
      <Flex align="center" gap={2}>
        <Button mode="bleed" icon={ArrowLeftIcon} text="Back" onClick={props.onBack} />
        <Box flex={1}>
          <Text weight="semibold" textOverflow="ellipsis">
            {a.name || a.id}
          </Text>
        </Box>
      </Flex>

      <Preview>
        {kind === 'video' && shownVideo ? (
          <video
            key={shownVideo.file}
            src={transcodeUrl(config.cdnBase, a.id, shownVideo.file)}
            poster={thumbnailUrl(config, a, 480)}
            controls
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img key={previewImage} src={previewImage} alt="" />
        )}
      </Preview>

      <Grid gridTemplateColumns={[2, 3]} gap={3}>
        <Fact label="Type" value={typeLabel(a.content_type)} />
        <Fact
          label="Size"
          value={a.metadata?.width ? `${a.metadata.width} × ${a.metadata.height} px` : undefined}
        />
        <Fact label="File size" value={formatBytes(a.size)} />
        <Fact label="Length" value={formatDuration(a.metadata?.duration)} />
        <Fact
          label="Uploaded"
          value={a.upload_time ? new Date(a.upload_time).toLocaleDateString() : undefined}
        />
      </Grid>

      {!full && !error && (
        <Flex justify="center">
          <Spinner muted />
        </Flex>
      )}
      {error && (
        <Card tone="critical" padding={3} radius={2} border>
          <Text size={1}>{error}</Text>
        </Card>
      )}

      {full && kind === 'image' && (
        <Stack gap={3}>
          <Text size={1} muted>
            {props.allowPrivate
              ? 'This copies the file into Sanity, which then serves it from its own CDN. Sanity’s image tools (hotspot, crop, @sanity/image-url) make the sizes your page needs.'
              : 'Your website gets a web-optimised copy, not the full file: FileSpin makes the size each spot needs and sends each browser AVIF, WebP or JPEG. Your developer sets the sizes with the plugin’s URL helpers.'}
          </Text>
          {formats.length > 0 && (
            <Stack gap={2}>
              <Text size={1} weight="medium">
                Format
              </Text>
              <Select value={variant} onChange={(e) => setVariant(e.currentTarget.value)}>
                <option value="">
                  {props.allowPrivate ? 'Original file' : 'Original (web-optimised)'}
                </option>
                {formats.map((f) => {
                  const off = !f.public && !props.allowPrivate
                  return (
                    <option key={f.name} value={f.name} disabled={off}>
                      {f.name}
                      {f.width ? ` (${f.width} × ${f.height})` : ''}
                      {off ? ' – private' : ''}
                    </option>
                  )
                })}
              </Select>
              <Text size={1} muted>
                {[
                  props.allowPrivate
                    ? 'Formats are other versions of this image saved in FileSpin, such as a background-removed copy.'
                    : 'Formats are other versions of this image saved in FileSpin, such as a background-removed copy. They are web-optimised the same way.',
                  !props.allowPrivate && formats.some((f) => !f.public)
                    ? 'Formats that are not public in FileSpin can’t be shown on a website, so you can’t pick them here.'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              </Text>
            </Stack>
          )}
        </Stack>
      )}

      {full && kind === 'video' && (
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Version
          </Text>
          {versions.length ? (
            <Select value={variant} onChange={(e) => setVariant(e.currentTarget.value)}>
              {props.allowPrivate && <option value="original">Original file</option>}
              {versions.map((v) => (
                <option key={v.file} value={v.file}>
                  {v.label}
                  {v.size ? ` (${formatBytes(v.size)})` : ''}
                </option>
              ))}
            </Select>
          ) : null}
          {versions.length > 0 && (
            <Text size={1} muted>
              {props.allowPrivate
                ? 'This copies the video file into Sanity.'
                : stream
                  ? chosenVersion?.watermarked
                    ? 'This watermarked version always plays as it is. Pick an unwatermarked version to also get adaptive streaming.'
                    : 'This video also streams adaptively (HLS): the quality follows each viewer’s connection. Browsers that can’t stream play this version instead.'
                  : 'The video file to play on your website. Smaller files start faster.'}
            </Text>
          )}
          {versions.length === 0 && (
            <Text size={1} muted>
              {props.allowPrivate
                ? 'Only the original file is available.'
                : 'This video has no public web version yet. In FileSpin, make a transcode (such as 720p) public, then try again.'}
            </Text>
          )}
        </Stack>
      )}

      {metadata.length > 0 && (
        <Stack gap={3}>
          <Text size={1} weight="medium">
            Metadata
          </Text>
          <Card padding={3} radius={2} border>
            <Grid gridTemplateColumns={[1, 2]} gap={3}>
              {metadata.map(([k, v]) => (
                <Fact key={k} label={humanise(k)} value={show(v)} />
              ))}
            </Grid>
          </Card>
        </Stack>
      )}

      <Flex gap={2} justify="flex-end" wrap="wrap">
        <Button
          as="a"
          href={dashboardAssetUrl(config, a.id)}
          target="_blank"
          rel="noopener noreferrer"
          mode="ghost"
          icon={LaunchIcon}
          text="Open in FileSpin"
        />
        <Button
          tone="primary"
          text={props.busy ? 'Adding…' : props.pickLabel}
          disabled={!full || props.busy || blocked}
          onClick={() => full && props.onPick(full, variant === 'original' ? '' : variant)}
        />
      </Flex>
    </Stack>
  )
}
