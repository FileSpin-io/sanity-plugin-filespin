import {useEffect, useState} from 'react'
import {Box, Button, Card, Checkbox, Flex, Select, Spinner, Stack, Text, TextInput} from '@sanity/ui'
import {ArrowLeftIcon} from '@sanity/icons/ArrowLeft'
import type {SchemaSummary} from '../api/types'
import {
  NO_FILTERS,
  UPLOADED_OPTIONS,
  kindOptions,
  localised,
  searchFieldsOf,
  type Filters,
  type SearchField,
} from '../lib/filters'
import {useFileSpin} from './FileSpinProvider'

/** Schemas, fetched once per page load: they rarely change. */
let schemaCache: Promise<SchemaSummary[]> | null = null

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <Stack gap={2}>
      <Text size={1} weight="medium">
        {label}
      </Text>
      {children}
    </Stack>
  )
}

function SchemaField({
  field,
  value,
  onChange,
}: {
  field: SearchField
  value: string | string[] | undefined
  onChange: (v: string | string[]) => void
}) {
  if (field.widget === 'select') {
    return (
      <Field label={field.label}>
        <Select value={(value as string) || ''} onChange={(e) => onChange(e.currentTarget.value)}>
          <option value="">Any</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    )
  }
  if (field.widget === 'multiselect') {
    const chosen = Array.isArray(value) ? value : []
    return (
      <Field label={field.label}>
        <Stack gap={2}>
          {field.options.map((o) => (
            <Flex key={o} as="label" align="center" gap={2}>
              <Checkbox
                checked={chosen.includes(o)}
                onChange={(e) =>
                  onChange(e.currentTarget.checked ? [...chosen, o] : chosen.filter((x) => x !== o))
                }
              />
              <Text size={1}>{o}</Text>
            </Flex>
          ))}
        </Stack>
      </Field>
    )
  }
  return (
    <Field label={field.label}>
      <TextInput
        type={field.widget === 'date' ? 'date' : 'text'}
        value={(value as string) || ''}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </Field>
  )
}

export function FiltersView(props: {
  value: Filters
  only?: 'image' | 'video'
  onApply: (f: Filters, schemas: SchemaSummary[]) => void
  onBack: () => void
}) {
  const {client} = useFileSpin()
  const [f, setF] = useState<Filters>(props.value)
  const [schemas, setSchemas] = useState<SchemaSummary[] | null>(null)

  useEffect(() => {
    let live = true
    if (!schemaCache) schemaCache = client.schemas().catch(() => ((schemaCache = null), []))
    schemaCache.then((s) => live && setSchemas(s))
    return () => {
      live = false
    }
  }, [client])

  const set = (patch: Partial<Filters>) => setF((x) => ({...x, ...patch}))
  const fields = searchFieldsOf(schemas?.find((s) => s.id === f.schemaId))

  return (
    <Stack gap={4}>
      <Flex align="center" gap={2}>
        <Button mode="bleed" icon={ArrowLeftIcon} text="Back" onClick={props.onBack} />
        <Box flex={1}>
          <Text weight="semibold">Filters</Text>
        </Box>
      </Flex>

      <Field label="File name">
        <TextInput
          value={f.fileName}
          placeholder="e.g. banner*"
          onChange={(e) => set({fileName: e.currentTarget.value})}
        />
      </Field>

      {props.only !== 'video' && (
        <Field label="File type">
          <Select value={f.kind} onChange={(e) => set({kind: e.currentTarget.value})}>
            {kindOptions(props.only).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Uploaded">
        <Select value={f.uploaded} onChange={(e) => set({uploaded: e.currentTarget.value})}>
          {UPLOADED_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {f.uploaded === 'custom' && (
          <Flex gap={2}>
            <Box flex={1}>
              <TextInput
                type="date"
                aria-label="From"
                value={f.from || ''}
                onChange={(e) => set({from: e.currentTarget.value})}
              />
            </Box>
            <Box flex={1}>
              <TextInput type="date" aria-label="To" value={f.to || ''} onChange={(e) => set({to: e.currentTarget.value})} />
            </Box>
          </Flex>
        )}
      </Field>

      <Flex as="label" align="center" gap={2}>
        <Checkbox checked={f.generatedOnly} onChange={(e) => set({generatedOnly: e.currentTarget.checked})} />
        <Text size={1}>Show only generated assets</Text>
      </Flex>

      <Field label="Metadata schema">
        {schemas === null ? (
          <Spinner muted />
        ) : (
          <Select
            value={f.schemaId == null ? '' : String(f.schemaId)}
            onChange={(e) => {
              const v = e.currentTarget.value
              set({schemaId: v ? Number(v) : undefined, fields: {}})
            }}
          >
            <option value="">Any</option>
            {schemas.map((s) => (
              <option key={s.id} value={s.id}>
                {localised(s.name) || `Schema ${s.id}`}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {f.schemaId != null && fields.length === 0 && schemas && (
        <Text size={1} muted>
          This schema has no searchable fields.
        </Text>
      )}
      {fields.length > 0 && (
        <Card padding={3} radius={2} border>
          <Stack gap={4}>
            {fields.map((field) => (
              <SchemaField
                key={field.name}
                field={field}
                value={f.fields[field.name]}
                onChange={(v) => set({fields: {...f.fields, [field.name]: v}})}
              />
            ))}
          </Stack>
        </Card>
      )}

      <Flex gap={2} justify="flex-end">
        <Button mode="ghost" text="Clear all" onClick={() => setF(NO_FILTERS)} />
        <Button tone="primary" text="Show results" onClick={() => props.onApply(f, schemas || [])} />
      </Flex>
    </Stack>
  )
}
