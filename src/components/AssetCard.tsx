import {PlayIcon} from '@sanity/icons/Play'
import {Box, Flex, Stack, Text} from '@sanity/ui'
import {styled} from 'styled-components'

import {formatBytes, formatDuration, typeLabel} from '../lib/media'
import type {FileSpinAssetValue} from '../types'
import {filespinImageUrl} from '../url'

const Media = styled.div<{$size: number}>`
  width: ${({$size}) => $size}px;
  height: ${({$size}) => $size}px;
  flex: none;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  background: var(--card-muted-bg-color, var(--card-bg2-color));
  & > img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
`

const PlayMark = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  filter: drop-shadow(0 0 4px rgb(0 0 0 / 0.6));
`

/** A still for any stored value: the image, or the video's poster. */
export function ValueThumb({value, size = 96}: {value: FileSpinAssetValue; size?: number}) {
  return (
    <Media $size={size}>
      <img src={filespinImageUrl(value, {width: 480, height: 480})} alt="" />
      {value.kind === 'video' && (
        <PlayMark>
          <PlayIcon />
        </PlayMark>
      )}
    </Media>
  )
}

/** One line about the stored version: type, size, length, which version. */
export function describe(value: FileSpinAssetValue): string {
  const parts = [typeLabel(value.contentType)]
  if (value.width) parts.push(`${value.width} × ${value.height}`)
  if (value.kind === 'video') {
    if (value.duration) parts.push(formatDuration(value.duration))
    if (value.variant) {
      const name = value.variant.replace(/\.mp4$/, '')
      const res = /^(\d+p)/.exec(name)?.[1] || name
      parts.push(name.includes('-wm-') ? `${res}, watermarked` : res)
    }
  } else {
    if (value.variant) parts.push(`format: ${value.variant}`)
    if (value.size) parts.push(`original ${formatBytes(value.size)}`)
  }
  return parts.filter(Boolean).join(' · ')
}

export function AssetCard({value, size = 96}: {value: FileSpinAssetValue; size?: number}) {
  return (
    <Flex align="center" gap={3}>
      <ValueThumb value={value} size={size} />
      <Box flex={1} style={{minWidth: 0}}>
        <Stack gap={2}>
          <Text size={1} weight="medium" textOverflow="ellipsis" title={value.name}>
            {value.name || value.assetId}
          </Text>
          <Text size={1} muted textOverflow="ellipsis">
            {describe(value)}
          </Text>
        </Stack>
      </Box>
    </Flex>
  )
}
