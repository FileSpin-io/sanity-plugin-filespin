/**
 * One asset: a bigger preview (a video plays), its facts, which version to
 * use (an image's formats or a video's web versions), and its metadata.
 */

import {useEffect, useMemo, useState} from 'react'
import {Box, Button, Card, Flex, Grid, Select, Spinner, Stack, Text} from '@sanity/ui'
import {ArrowLeftIcon} from '@sanity/icons/ArrowLeft'
import {LaunchIcon} from '@sanity/icons/Launch'
import {styled} from 'styled-components'
import type {FileSpinAsset} from '../api/types'
import {
  bestVersion,
  dashboardAssetUrl,
  formatBytes,
  formatDuration,
  imageFormats,
  kindOf,
  thumbnailUrl,
  typeLabel,
  videoVersions,
} from '../lib/media'
import {humanise} from '../lib/filters'
import {transcodeUrl} from '../url'
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
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map(show).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
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

  useEffect(() => {
    let live = true
    setFull(null)
    setError('')
    client
      .asset(props.asset.id)
      .then((a) => {
        if (!live) return
        setFull(a)
        if (kindOf(a) === 'video') setVariant(bestVersion(videoVersions(a))?.file || '')
      })
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [client, props.asset.id])

  const a = full || props.asset
  const formats = useMemo(() => (full ? imageFormats(full) : []), [full])
  const versions = useMemo(() => (full ? videoVersions(full) : []), [full])
  // The smallest web version plays fastest in the preview.
  const previewVideo = versions.length ? [...versions].sort((x, y) => x.height - y.height)[0] : undefined
  const chosenFormat = formats.find((f) => f.name === variant)
  const blocked =
    (kind === 'image' && chosenFormat && !chosenFormat.public && !props.allowPrivate) ||
    (kind === 'video' && !props.allowPrivate && !versions.length)

  const metadata = Object.entries(a.data || {}).filter(([k, v]) => !k.startsWith('_') && show(v) !== '')

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
        {kind === 'video' && previewVideo ? (
          <video
            src={transcodeUrl(config.cdnBase, a.id, previewVideo.file)}
            poster={thumbnailUrl(config, a, 480)}
            controls
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={thumbnailUrl(config, a, 480)} alt="" />
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
        <Fact label="Uploaded" value={a.upload_time ? new Date(a.upload_time).toLocaleDateString() : undefined} />
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

      {full && kind === 'image' && formats.length > 0 && (
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Format
          </Text>
          <Select value={variant} onChange={(e) => setVariant(e.currentTarget.value)}>
            <option value="">Original</option>
            {formats.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
                {f.width ? ` (${f.width} × ${f.height})` : ''}
                {!f.public && !props.allowPrivate ? ' – private' : ''}
              </option>
            ))}
          </Select>
          {chosenFormat && !chosenFormat.public && !props.allowPrivate && (
            <Text size={1} muted>
              This format is private in FileSpin, so a website can’t show it. Make it public in FileSpin to use it.
            </Text>
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
          ) : (
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
          disabled={!full || props.busy || !!blocked}
          onClick={() => full && props.onPick(full, variant === 'original' ? '' : variant)}
        />
      </Flex>
    </Stack>
  )
}
