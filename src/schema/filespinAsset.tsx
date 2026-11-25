import {defineField, defineType, type ObjectDefinition} from 'sanity'
import type {ResolvedConfig} from '../config'
import {describe, ValueThumb} from '../components/AssetCard'
import {FileSpinDiff} from '../components/FileSpinDiff'
import {FileSpinIcon} from '../components/FileSpinIcon'
import {makeFileSpinInput, type FileSpinAssetOptions} from '../components/FileSpinInput'
import type {FileSpinAssetValue} from '../types'

export const FILESPIN_ASSET = 'filespin.asset'

/**
 * `filespin.asset`: an image or video that stays in FileSpin. Add it to a
 * document like any field:
 *
 *   defineField({name: 'hero', type: 'filespin.asset', options: {accept: 'image'}})
 *
 * The fields are filled by the picker and hidden from editors, apart from
 * alt text, which the input shows itself.
 */
export function filespinAssetType(config: ResolvedConfig) {
  const hidden = {hidden: true, readOnly: true}
  return defineType({
    name: FILESPIN_ASSET,
    title: 'FileSpin asset',
    type: 'object',
    icon: FileSpinIcon,
    fields: [
      defineField({name: 'assetId', title: 'Asset ID', type: 'string', ...hidden}),
      defineField({name: 'name', title: 'File name', type: 'string', ...hidden}),
      defineField({name: 'kind', title: 'Kind', type: 'string', ...hidden}),
      defineField({name: 'contentType', title: 'MIME type', type: 'string', ...hidden}),
      defineField({name: 'width', title: 'Width', type: 'number', ...hidden}),
      defineField({name: 'height', title: 'Height', type: 'number', ...hidden}),
      defineField({name: 'size', title: 'Bytes', type: 'number', ...hidden}),
      defineField({name: 'duration', title: 'Duration (s)', type: 'number', ...hidden}),
      defineField({name: 'variant', title: 'Version', type: 'string', ...hidden}),
      defineField({name: 'url', title: 'URL', type: 'url', ...hidden}),
      defineField({name: 'posterUrl', title: 'Poster URL', type: 'url', ...hidden}),
      defineField({name: 'cdn', title: 'CDN', type: 'url', ...hidden}),
      defineField({name: 'version', title: 'Image version', type: 'number', ...hidden}),
      defineField({name: 'alt', title: 'Alternative text', type: 'string'}),
    ],
    components: {
      input: makeFileSpinInput(config),
      diff: FileSpinDiff,
    },
    preview: {
      select: {
        assetId: 'assetId',
        name: 'name',
        kind: 'kind',
        contentType: 'contentType',
        width: 'width',
        height: 'height',
        duration: 'duration',
        variant: 'variant',
        url: 'url',
        posterUrl: 'posterUrl',
        cdn: 'cdn',
        version: 'version',
        alt: 'alt',
      },
      prepare(v: Partial<FileSpinAssetValue>) {
        if (!v.assetId) return {title: 'No FileSpin asset', media: FileSpinIcon}
        const value = v as FileSpinAssetValue
        return {
          title: value.alt || value.name || value.assetId,
          subtitle: describe(value),
          media: <ValueThumb value={value} size={33} />,
        }
      },
    },
  })
}

declare module 'sanity' {
  // Lets `defineField({type: 'filespin.asset', options: {accept: 'image'}})` type-check.
  export interface FileSpinAssetDefinition extends Omit<ObjectDefinition, 'type' | 'fields' | 'options'> {
    type: typeof FILESPIN_ASSET
    options?: FileSpinAssetOptions
  }
  export interface IntrinsicDefinitions {
    'filespin.asset': FileSpinAssetDefinition
  }
}
