import {DiffFromTo, type DiffComponent, type ObjectDiff} from 'sanity'
import {Box, Card, Text} from '@sanity/ui'
import type {FileSpinAssetValue} from '../types'
import {AssetCard} from './AssetCard'

function Side({value}: {value?: FileSpinAssetValue | null}) {
  if (!value?.assetId) {
    return (
      <Box padding={2}>
        <Text size={1} muted>
          (none)
        </Text>
      </Box>
    )
  }
  return (
    <Card padding={2}>
      <AssetCard value={value} size={64} />
      {value.alt && (
        <Box paddingTop={2}>
          <Text size={1} muted>
            Alt: {value.alt}
          </Text>
        </Box>
      )}
    </Card>
  )
}

/** Review changes: the asset before and after, side by side. */
export const FileSpinDiff: DiffComponent<ObjectDiff<FileSpinAssetValue>> = ({diff, schemaType}) => (
  <DiffFromTo diff={diff} schemaType={schemaType} previewComponent={Side} layout="grid" />
)
