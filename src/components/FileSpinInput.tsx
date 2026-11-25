/**
 * The `filespin.asset` field: shows the chosen asset, and opens the FileSpin
 * panel to choose, replace or change its version. The file stays in FileSpin;
 * the field stores its CDN URL and facts (see FileSpinAssetValue).
 */

import {useCallback, useState, type ComponentType} from 'react'
import {set, unset, type ObjectInputProps, type ObjectSchemaType} from 'sanity'
import {Box, Button, Card, Dialog, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {Menu, MenuButton, MenuDivider, MenuItem} from '@sanity/ui/menu'
import {useToast} from '@sanity/ui/toast'
import {CopyIcon} from '@sanity/icons/Copy'
import {EllipsisHorizontalIcon} from '@sanity/icons/EllipsisHorizontal'
import {LaunchIcon} from '@sanity/icons/Launch'
import {ResetIcon} from '@sanity/icons/Reset'
import {TrashIcon} from '@sanity/icons/Trash'
import type {ResolvedConfig} from '../config'
import type {FileSpinAsset} from '../api/types'
import type {FileSpinAssetValue} from '../types'
import {dashboardAssetUrl, toValue} from '../lib/media'
import {AssetCard} from './AssetCard'
import {Browser, type Only} from './Browser'
import {FileSpinIcon} from './FileSpinIcon'
import {FileSpinProvider, useFileSpin} from './FileSpinProvider'

/** Options a schema can set on a `filespin.asset` field. @public */
export interface FileSpinAssetOptions {
  /** Offer only images or only videos. Default: both. */
  accept?: 'image' | 'video'
}

type Props = ObjectInputProps<FileSpinAssetValue, ObjectSchemaType & {options?: FileSpinAssetOptions}>

function Input(props: Props) {
  const {value, onChange, readOnly, schemaType, id} = props
  const {client, config} = useFileSpin()
  const toast = useToast()
  const [open, setOpen] = useState<null | 'choose' | 'version'>(null)
  const only: Only = schemaType.options?.accept

  const onPick = useCallback(
    async (a: FileSpinAsset, variant: string) => {
      // Search results lack conversions and the image version: read the full asset
      // (Details already did).
      const full = a.addons_info ? a : await client.asset(a.id)
      const next = toValue(config, full, variant)
      if ('error' in next) throw new Error(next.error)
      if (only && next.kind !== only) throw new Error(`This field takes ${only}s only.`)
      // Alt text describes the picture, so it stays only for the same asset.
      const alt = value?.assetId === next.assetId ? value.alt : undefined
      onChange(set({...next, ...(alt ? {alt} : {})}))
      setOpen(null)
    },
    [client, config, only, onChange, value?.alt, value?.assetId],
  )

  const dialog = open && (
    <Dialog
      id={`${id}-filespin`}
      header={
        <Flex align="center" gap={2}>
          <FileSpinIcon />
          <span>{open === 'version' ? 'Choose a version' : 'Add from FileSpin'}</span>
        </Flex>
      }
      width={3}
      onClose={() => setOpen(null)}
      onClickOutside={() => setOpen(null)}
    >
      <Box padding={4}>
        <Browser
          only={only}
          pickLabel={open === 'version' ? 'Use this version' : `Use this ${only || 'file'}`}
          selectedId={value?.assetId}
          startWith={
            open === 'version' && value
              ? {id: value.assetId, name: value.name, content_type: value.contentType}
              : undefined
          }
          onPick={onPick}
        />
      </Box>
    </Dialog>
  )

  if (!value?.assetId) {
    return (
      <>
        <Card padding={4} radius={2} border style={{borderStyle: 'dashed'}}>
          <Flex direction="column" align="center" gap={3}>
            <Text size={1} muted>
              {only === 'video' ? 'No video chosen' : only === 'image' ? 'No image chosen' : 'Nothing chosen yet'}
            </Text>
            <Button
              icon={FileSpinIcon}
              mode="ghost"
              text="Choose from FileSpin"
              disabled={readOnly}
              onClick={() => setOpen('choose')}
            />
          </Flex>
        </Card>
        {dialog}
      </>
    )
  }

  const copyUrl = () => {
    navigator.clipboard
      ?.writeText(value.url)
      .then(() => toast.push({status: 'success', title: 'URL copied'}))
      .catch(() => toast.push({status: 'error', title: 'Could not copy the URL'}))
  }

  return (
    <Stack gap={3}>
      <Card padding={2} radius={2} border>
        <Flex align="center" gap={2}>
          <Box flex={1} style={{minWidth: 0}}>
            <AssetCard value={value} />
          </Box>
          <Flex gap={1} align="center">
            <Button mode="ghost" text="Replace" disabled={readOnly} onClick={() => setOpen('choose')} />
            <MenuButton
              id={`${id}-filespin-menu`}
              button={<Button mode="bleed" icon={EllipsisHorizontalIcon} aria-label="More" />}
              popover={{portal: true, placement: 'bottom-end'}}
              menu={
                <Menu>
                  <MenuItem
                    icon={ResetIcon}
                    text={value.kind === 'video' ? 'Change version' : 'Change format'}
                    disabled={readOnly}
                    onClick={() => setOpen('version')}
                  />
                  <MenuItem icon={CopyIcon} text="Copy URL" onClick={copyUrl} />
                  <MenuItem
                    icon={LaunchIcon}
                    text="Open in FileSpin"
                    as="a"
                    href={dashboardAssetUrl(config, value.assetId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                  <MenuDivider />
                  <MenuItem
                    icon={TrashIcon}
                    text="Remove"
                    tone="critical"
                    disabled={readOnly}
                    onClick={() => onChange(unset())}
                  />
                </Menu>
              }
            />
          </Flex>
        </Flex>
      </Card>
      {value.kind === 'image' && (
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Alternative text
          </Text>
          <Text size={1} muted>
            Describes the image for people who can’t see it, and for search engines.
          </Text>
          <TextInput
            value={value.alt || ''}
            readOnly={readOnly}
            onChange={(e) => {
              const alt = e.currentTarget.value
              onChange(alt ? set(alt, ['alt']) : unset(['alt']))
            }}
          />
        </Stack>
      )}
      {dialog}
    </Stack>
  )
}

export function makeFileSpinInput(config: ResolvedConfig): ComponentType<ObjectInputProps> {
  function FileSpinAssetInput(props: Props) {
    return (
      <FileSpinProvider config={config}>
        <Input {...props} />
      </FileSpinProvider>
    )
  }
  return FileSpinAssetInput as unknown as ComponentType<ObjectInputProps>
}
