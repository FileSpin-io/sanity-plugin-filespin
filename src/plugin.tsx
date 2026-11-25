import {defineLocaleResourceBundle, definePlugin, type AssetSource} from 'sanity'

import {ASSET_SOURCE_NAME, makeAssetSourceComponent} from './components/FileSpinAssetSource'
import {FileSpinIcon} from './components/FileSpinIcon'
import {resolveConfig, type FileSpinPluginConfig} from './config'
import {filespinAssetType} from './schema/filespinAsset'

/**
 * FileSpin for Sanity Studio.
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {filespin} from 'sanity-plugin-filespin'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [filespin()],
 * })
 * ```
 *
 * Adds the `filespin.asset` field type (files stay in FileSpin, served from
 * its CDN) and FileSpin as a source in Sanity's image and file pickers
 * (copies the file into Sanity; turn off with `assetSource: false`).
 *
 * @public
 */
export const filespin = definePlugin<FileSpinPluginConfig | void>((options) => {
  const config = resolveConfig(options || {})
  const source: AssetSource = {
    name: ASSET_SOURCE_NAME,
    // Studio looks this up in its own ("studio") namespace; the bundle below adds it.
    i18nKey: 'filespin.asset-source.title',
    icon: FileSpinIcon,
    component: makeAssetSourceComponent(config),
  }
  return {
    name: 'sanity-plugin-filespin',
    i18n: {
      bundles: [
        defineLocaleResourceBundle({
          locale: 'en-US',
          namespace: 'studio',
          resources: {'filespin.asset-source.title': 'FileSpin'},
        }),
      ],
    },
    schema: {types: [filespinAssetType(config)]},
    form: config.assetSource
      ? {
          image: {assetSources: (prev) => [...prev, source]},
          file: {assetSources: (prev) => [...prev, source]},
        }
      : undefined,
  }
})
