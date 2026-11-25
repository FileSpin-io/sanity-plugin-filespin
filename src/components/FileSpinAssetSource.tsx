/**
 * FileSpin in Sanity's own image and file pickers ("Select" > FileSpin).
 * Unlike the `filespin.asset` field, this COPIES the file into Sanity's asset
 * store: Sanity downloads it from a one-hour signed FileSpin link and keeps
 * its own copy, with `source` pointing back at the FileSpin asset (so picking
 * the same file again reuses the copy). Use it where a schema already has
 * image fields and Sanity's image pipeline (hotspot, crop) is wanted.
 */

import {useCallback} from 'react'
import type {AssetFromSource, AssetSourceComponentProps} from 'sanity'
import {Box, Dialog, Flex, Text} from '@sanity/ui'
import type {ResolvedConfig} from '../config'
import type {FileSpinAsset} from '../api/types'
import {dashboardAssetUrl, kindOf} from '../lib/media'
import {Browser, type Only} from './Browser'
import {FileSpinIcon} from './FileSpinIcon'
import {FileSpinProvider, useFileSpin} from './FileSpinProvider'

export const ASSET_SOURCE_NAME = 'filespin'

/** "image/*" -> images only; "video/*" -> videos only; anything else -> both. */
function onlyFor(accept: string, assetType?: string): Only {
  if (assetType === 'image' || /^image\//.test(accept)) return 'image'
  const types = accept.split(',').map((t) => t.trim()).filter(Boolean)
  if (types.length && types.every((t) => t.startsWith('video/'))) return 'video'
  return undefined
}

function Source(props: AssetSourceComponentProps) {
  const {client, config} = useFileSpin()
  const {onSelect, onClose, accept, assetType, dialogHeaderTitle} = props
  const only = onlyFor(accept || '', assetType)

  const onPick = useCallback(
    async (a: FileSpinAsset, variant: string) => {
      const kind = kindOf(a)
      if (only && kind !== only) throw new Error(`Choose ${only === 'image' ? 'an image' : 'a video'} here.`)
      // A video version is chosen by file ("720p-video.mp4"); its link key is the name.
      const key = variant ? variant.replace(/\.mp4$/, '') : 'original'
      const link = await client.fileLink(a.id, key)
      const asset: AssetFromSource = {
        kind: 'url',
        value: link,
        assetDocumentProps: {
          originalFilename: a.name,
          source: {
            name: ASSET_SOURCE_NAME,
            // Each version is its own copy in Sanity.
            id: variant ? `${a.id}:${key}` : a.id,
            url: dashboardAssetUrl(config, a.id),
          },
        } as AssetFromSource['assetDocumentProps'],
      }
      onSelect([asset])
    },
    [client, config, only, onSelect],
  )

  return (
    <Dialog
      id="filespin-asset-source"
      header={
        <Flex align="center" gap={2}>
          <FileSpinIcon />
          <span>{typeof dialogHeaderTitle === 'string' ? dialogHeaderTitle : 'Select from FileSpin'}</span>
        </Flex>
      }
      width={3}
      onClose={onClose}
      onClickOutside={onClose}
    >
      <Box padding={4}>
        <Box marginBottom={4}>
          <Text size={1} muted>
            A copy of the file is saved in Sanity. To keep files in FileSpin and serve them from the FileSpin CDN,
            use a FileSpin asset field instead.
          </Text>
        </Box>
        <Browser only={only} allowPrivate pickLabel="Copy into Sanity" onPick={onPick} />
      </Box>
    </Dialog>
  )
}

export function makeAssetSourceComponent(config: ResolvedConfig) {
  return function FileSpinAssetSource(props: AssetSourceComponentProps) {
    return (
      <FileSpinProvider config={config}>
        <Source {...props} />
      </FileSpinProvider>
    )
  }
}
