import {InfoOutlineIcon} from '@sanity/icons/InfoOutline'
import {PlayIcon} from '@sanity/icons/Play'
import {Badge, Box, Button, Card, Flex, Grid, Spinner, Stack, Text} from '@sanity/ui'
import {Tooltip} from '@sanity/ui/tooltip'
import {styled} from 'styled-components'

import type {FileSpinAsset} from '../api/types'
import {formatDuration, kindOf, thumbnailUrl, typeLabel} from '../lib/media'
import {useFileSpin} from './FileSpinProvider'

const Thumb = styled.div`
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 3px;
  /* A checkerboard shows where an image is transparent. */
  background-color: var(--card-bg-color);
  background-image:
    linear-gradient(45deg, var(--card-border-color) 25%, transparent 25%),
    linear-gradient(-45deg, var(--card-border-color) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--card-border-color) 75%),
    linear-gradient(-45deg, transparent 75%, var(--card-border-color) 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;

  & > img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
`

const Corner = styled.div<{$side: 'left' | 'right'}>`
  position: absolute;
  top: 4px;
  ${({$side}) => $side}: 4px;
`

const DetailsCorner = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
`

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--card-bg-color) 60%, transparent);
`

const Tile = styled.div`
  position: relative;
`

/** The whole tile adds the asset; the (i) button sits on top of it, outside it. */
const PickButton = styled(Card)`
  width: 100%;
  text-align: left;
`

export function AssetGrid(props: {
  items: FileSpinAsset[]
  busyId?: string
  selectedId?: string
  onPick: (a: FileSpinAsset) => void
  onDetails: (a: FileSpinAsset) => void
}) {
  const {config} = useFileSpin()
  const {items, busyId, selectedId, onPick, onDetails} = props
  return (
    <Grid gridTemplateColumns={[2, 3, 4, 5]} gap={3}>
      {items.map((a) => {
        const kind = kindOf(a)
        const label = a.name || a.id
        return (
          <Tile key={a.id}>
            <PickButton
              as="button"
              type="button"
              padding={1}
              radius={2}
              border
              tone={a.id === selectedId ? 'primary' : 'default'}
              aria-label={`Add ${label}`}
              disabled={!!busyId}
              onClick={() => onPick(a)}
            >
              <Stack gap={2}>
                <Thumb>
                  <img src={thumbnailUrl(config, a)} alt="" loading="lazy" draggable={false} />
                  <Corner $side="left">
                    {kind === 'video' ? (
                      <Badge tone="primary" fontSize={0}>
                        <Flex align="center" gap={1}>
                          <PlayIcon />
                          {formatDuration(a.metadata?.duration) || 'Video'}
                        </Flex>
                      </Badge>
                    ) : (
                      <Badge fontSize={0}>{typeLabel(a.content_type)}</Badge>
                    )}
                  </Corner>
                  {busyId === a.id && (
                    <Overlay>
                      <Spinner />
                    </Overlay>
                  )}
                </Thumb>
                <Box paddingX={1} paddingBottom={1}>
                  <Text size={1} textOverflow="ellipsis" title={label}>
                    {label}
                  </Text>
                </Box>
              </Stack>
            </PickButton>
            <DetailsCorner>
              <Tooltip content={<Text size={1}>Details and versions</Text>} portal placement="top">
                <Button
                  mode="ghost"
                  padding={2}
                  fontSize={1}
                  icon={InfoOutlineIcon}
                  aria-label={`Details of ${label}`}
                  onClick={() => onDetails(a)}
                />
              </Tooltip>
            </DetailsCorner>
          </Tile>
        )
      })}
    </Grid>
  )
}
