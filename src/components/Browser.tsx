/**
 * The FileSpin panel: the same screens as FileSpin's Canva, Figma and
 * WordPress apps.
 *
 *   Assets       search, Filters, sort; click a tile to add it, (i) for details
 *   Collections  search collections, open one, search inside it
 *   Details      preview, facts, version, metadata
 *
 * Used by the `filespin.asset` field and by the asset source in Sanity's own
 * image and file pickers. The host decides what "add" means (onPick).
 */

import {useMemo, useState, type ReactNode} from 'react'
import {Box, Button, Card, Flex, Select, Spinner, Stack, Tab, TabList, Text, TextInput} from '@sanity/ui'
import {Menu, MenuButton, MenuDivider, MenuItem} from '@sanity/ui/menu'
import {ArrowLeftIcon} from '@sanity/icons/ArrowLeft'
import {ChevronRightIcon} from '@sanity/icons/ChevronRight'
import {EllipsisHorizontalIcon} from '@sanity/icons/EllipsisHorizontal'
import {FilterIcon} from '@sanity/icons/Filter'
import {FolderIcon} from '@sanity/icons/Folder'
import {LaunchIcon} from '@sanity/icons/Launch'
import {LeaveIcon} from '@sanity/icons/Leave'
import {SearchIcon} from '@sanity/icons/Search'
import {styled} from 'styled-components'
import {ForbiddenError, NotAuthorizedError} from '../api/client'
import type {FileSpinAsset, FileSpinCollection, SchemaSummary} from '../api/types'
import {IMAGE_TYPES, LISTED_TYPES} from '../config'
import {NO_FILTERS, SORT_OPTIONS, activeCount, toAssetFilters, type Filters} from '../lib/filters'
import {odiUrl} from '../url'
import {AssetGrid} from './AssetGrid'
import {DetailsView} from './DetailsView'
import {useFileSpin} from './FileSpinProvider'
import {FileSpinIcon} from './FileSpinIcon'
import {FiltersView} from './FiltersView'
import {SignIn} from './SignIn'
import {clearPageCache, useDebounced, usePaged} from './usePaged'

export type Only = 'image' | 'video' | undefined

export interface BrowserProps {
  only?: Only
  /** Copy mode (asset source): private formats and the original video are usable too. */
  allowPrivate?: boolean
  pickLabel: string
  selectedId?: string
  /** Open straight on this asset's details (to change the version). */
  startWith?: FileSpinAsset
  /** Resolve when done; throw to show the error and stay open. */
  onPick: (asset: FileSpinAsset, variant: string) => Promise<void>
}

const typesFor = (only: Only) => (only === 'image' ? IMAGE_TYPES : only === 'video' ? ['video*'] : LISTED_TYPES)
const kindsFor = (only: Only): ('image' | 'video')[] => (only ? [only] : ['image', 'video'])

function Results(props: {
  list: ReturnType<typeof usePaged<any>>
  emptyText: string
  noun: [string, string]
  children: ReactNode
}) {
  const {list} = props
  if (list.error) {
    return (
      <Card tone="critical" padding={3} radius={2} border>
        <Flex align="center" gap={3} wrap="wrap">
          <Box flex={1}>
            <Text size={1}>{list.error.message || 'FileSpin could not be reached.'}</Text>
          </Box>
          <Button mode="ghost" text="Try again" onClick={list.reload} />
        </Flex>
      </Card>
    )
  }
  return (
    <Stack gap={3}>
      {list.items.length > 0 && (
        <Text size={1} muted>
          {list.total.toLocaleString()} {list.total === 1 ? props.noun[0] : props.noun[1]}
        </Text>
      )}
      {props.children}
      {list.loading && (
        <Flex justify="center" padding={4}>
          <Spinner muted />
        </Flex>
      )}
      {!list.loading && list.items.length === 0 && (
        <Box padding={4}>
          <Text size={1} muted align="center">
            {props.emptyText}
          </Text>
        </Box>
      )}
      {list.more && (
        <Flex justify="center">
          <Button mode="ghost" text="Load more" onClick={list.more} />
        </Flex>
      )}
    </Stack>
  )
}

function AssetsTab(props: {
  only: Only
  keyword: string
  typed: string
  setTyped: (s: string) => void
  sort: string
  setSort: (s: string) => void
  filters: Filters
  schemas: SchemaSummary[]
  clearFilters: () => void
  openFilters: () => void
  grid: (items: FileSpinAsset[]) => ReactNode
}) {
  const {client, session} = useFileSpin()
  const {only, keyword, sort, filters, schemas} = props
  const apiFilters = useMemo(() => toAssetFilters(filters, schemas, only), [filters, schemas, only])
  const list = usePaged<FileSpinAsset>(
    JSON.stringify(['assets', session?.email, only, keyword, sort, apiFilters]),
    (page, sid) =>
      page > 1 && sid
        ? client.searchPage(sid, page)
        : client.search({keyword, sort, filters: apiFilters, types: typesFor(only)}),
  )
  const count = activeCount(filters)
  return (
    <Stack gap={3}>
      <TextInput
        icon={SearchIcon}
        placeholder="Search FileSpin"
        aria-label="Search FileSpin"
        value={props.typed}
        onChange={(e) => props.setTyped(e.currentTarget.value)}
        clearButton={!!props.typed}
        onClear={() => props.setTyped('')}
      />
      <Flex gap={2} align="center" wrap="wrap">
        <Button
          mode={count ? 'default' : 'ghost'}
          tone={count ? 'primary' : 'default'}
          icon={FilterIcon}
          text={count ? `Filters (${count})` : 'Filters'}
          onClick={props.openFilters}
        />
        {count > 0 && <Button mode="bleed" text="Clear" onClick={props.clearFilters} />}
        <Box flex={1} />
        <Box style={{minWidth: 140}}>
          <Select aria-label="Sort by" value={sort} onChange={(e) => props.setSort(e.currentTarget.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Box>
      </Flex>
      <Results
        list={list}
        noun={['result', 'results']}
        emptyText={
          only === 'video'
            ? 'No videos match. Try another word or clear the filters.'
            : only === 'image'
              ? 'No images match. Try another word or clear the filters.'
              : 'No images or videos match. Try another word or clear the filters.'
        }
      >
        {props.grid(list.items)}
      </Results>
    </Stack>
  )
}

const CollectionRow = styled(Card)`
  cursor: pointer;
`

const Cover = styled.div`
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-muted-bg-color, var(--card-bg2-color));
  & > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

function CollectionList({onOpen}: {onOpen: (c: FileSpinCollection) => void}) {
  const {client, config, session} = useFileSpin()
  const [typed, setTyped] = useState('')
  const keyword = useDebounced(typed.trim())
  const list = usePaged<FileSpinCollection>(JSON.stringify(['collections', session?.email, keyword]), (page) =>
    client.collections({keyword, page}),
  )
  return (
    <Stack gap={3}>
      <TextInput
        icon={SearchIcon}
        placeholder="Search collections"
        aria-label="Search collections"
        value={typed}
        onChange={(e) => setTyped(e.currentTarget.value)}
        clearButton={!!typed}
        onClear={() => setTyped('')}
      />
      <Results list={list} noun={['collection', 'collections']} emptyText="No collections found.">
        <Stack gap={2}>
          {list.items.map((c) => (
            <CollectionRow
              key={c.id}
              padding={2}
              radius={2}
              border
              tabIndex={0}
              role="button"
              onClick={() => onOpen(c)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onOpen(c)}
            >
              <Flex align="center" gap={3}>
                <Cover>
                  {c.assets?.[0] ? (
                    <img src={odiUrl(config.cdnBase, c.assets[0], {resize: '240,240'})} alt="" loading="lazy" />
                  ) : (
                    <Text muted>
                      <FolderIcon />
                    </Text>
                  )}
                </Cover>
                <Stack gap={2} flex={1}>
                  <Text size={1} weight="medium" textOverflow="ellipsis">
                    {c.name}
                  </Text>
                  <Text size={0} muted>
                    {(c.assets?.length || 0).toLocaleString()} {c.assets?.length === 1 ? 'asset' : 'assets'}
                  </Text>
                </Stack>
                <Text muted>
                  <ChevronRightIcon />
                </Text>
              </Flex>
            </CollectionRow>
          ))}
        </Stack>
      </Results>
    </Stack>
  )
}

function CollectionAssets(props: {
  collection: FileSpinCollection
  only: Only
  onBack: () => void
  grid: (items: FileSpinAsset[]) => ReactNode
}) {
  const {client, session} = useFileSpin()
  const [typed, setTyped] = useState('')
  const keyword = useDebounced(typed.trim())
  const {collection, only} = props
  const list = usePaged<FileSpinAsset>(
    JSON.stringify(['collection', session?.email, collection.id, only, keyword]),
    (page) => client.collectionAssets(collection.id, {keyword, page, kinds: kindsFor(only)}),
  )
  return (
    <Stack gap={3}>
      <Flex align="center" gap={2}>
        <Button mode="bleed" icon={ArrowLeftIcon} text="Collections" onClick={props.onBack} />
        <Box flex={1}>
          <Text weight="semibold" textOverflow="ellipsis">
            {collection.name}
          </Text>
        </Box>
      </Flex>
      <TextInput
        icon={SearchIcon}
        placeholder={`Search in ${collection.name}`}
        aria-label="Search in this collection"
        value={typed}
        onChange={(e) => setTyped(e.currentTarget.value)}
        clearButton={!!typed}
        onClear={() => setTyped('')}
      />
      <Results list={list} noun={['item', 'items']} emptyText="Nothing here that this field can use.">
        {props.grid(list.items)}
      </Results>
    </Stack>
  )
}

export function Browser(props: BrowserProps) {
  const {session} = useFileSpin()
  if (!session) return <SignIn />
  return <SignedInBrowser {...props} />
}

function SignedInBrowser({only, allowPrivate = false, pickLabel, selectedId, startWith, onPick}: BrowserProps) {
  const {config, store, session} = useFileSpin()
  const [tab, setTab] = useState<'assets' | 'collections'>('assets')
  const [typed, setTyped] = useState('')
  const keyword = useDebounced(typed.trim())
  const [sort, setSort] = useState('newest')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [schemas, setSchemas] = useState<SchemaSummary[]>([])
  const [screen, setScreen] = useState<'list' | 'filters'>('list')
  const [details, setDetails] = useState<FileSpinAsset | null>(startWith || null)
  const [collection, setCollection] = useState<FileSpinCollection | null>(null)
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState('')

  const pick = async (a: FileSpinAsset, variant = '') => {
    if (busyId) return
    setBusyId(a.id)
    setError('')
    try {
      await onPick(a, variant)
    } catch (e) {
      if (e instanceof NotAuthorizedError) return // back to sign-in by itself
      setError(
        e instanceof ForbiddenError
          ? 'Your FileSpin account can’t use this file.'
          : e instanceof Error
            ? e.message
            : 'That didn’t work. Try again.',
      )
    } finally {
      setBusyId(undefined)
    }
  }

  const grid = (items: FileSpinAsset[]) => (
    <AssetGrid items={items} busyId={busyId} selectedId={selectedId} onPick={(a) => pick(a)} onDetails={setDetails} />
  )

  const signOut = async () => {
    clearPageCache()
    await store.signOut()
  }

  // The list stays mounted under Details and Filters, so going back keeps
  // its loaded pages and scroll position.
  const list =
    tab === 'collections' ? (
      collection ? (
        <CollectionAssets collection={collection} only={only} onBack={() => setCollection(null)} grid={grid} />
      ) : (
        <CollectionList onOpen={setCollection} />
      )
    ) : (
      <AssetsTab
        only={only}
        keyword={keyword}
        typed={typed}
        setTyped={setTyped}
        sort={sort}
        setSort={setSort}
        filters={filters}
        schemas={schemas}
        clearFilters={() => setFilters(NO_FILTERS)}
        openFilters={() => setScreen('filters')}
        grid={grid}
      />
    )
  const overlay = details ? (
    <DetailsView
      asset={details}
      allowPrivate={allowPrivate}
      busy={busyId === details.id}
      pickLabel={pickLabel}
      onPick={(a, v) => pick(a, v)}
      onBack={() => setDetails(null)}
    />
  ) : screen === 'filters' ? (
    <FiltersView
      value={filters}
      only={only}
      onBack={() => setScreen('list')}
      onApply={(f, s) => {
        setFilters(f)
        setSchemas(s)
        setScreen('list')
      }}
    />
  ) : null

  return (
    <Stack gap={4}>
      <Flex align="center" gap={2}>
        <TabList gap={1}>
          <Tab
            id="filespin-tab-assets"
            aria-controls="filespin-panel"
            label="Assets"
            selected={tab === 'assets'}
            onClick={() => {
              setTab('assets')
              setDetails(null)
              setScreen('list')
            }}
          />
          <Tab
            id="filespin-tab-collections"
            aria-controls="filespin-panel"
            label="Collections"
            selected={tab === 'collections'}
            onClick={() => {
              setTab('collections')
              setDetails(null)
              setScreen('list')
            }}
          />
        </TabList>
        <Box flex={1} />
        <MenuButton
          id="filespin-account-menu"
          button={<Button mode="bleed" icon={EllipsisHorizontalIcon} aria-label="FileSpin account" />}
          popover={{portal: true, placement: 'bottom-end'}}
          menu={
            <Menu>
              <Box padding={3}>
                <Flex align="center" gap={2}>
                  <Text size={1}>
                    <FileSpinIcon />
                  </Text>
                  <Text size={1} muted>
                    {session?.email || 'Signed in to FileSpin'}
                  </Text>
                </Flex>
              </Box>
              <MenuDivider />
              <MenuItem
                icon={LaunchIcon}
                text="Open FileSpin"
                as="a"
                href={`${config.dashboardBase}/assets`}
                target="_blank"
                rel="noopener noreferrer"
              />
              <MenuItem icon={LeaveIcon} text="Sign out of FileSpin" tone="critical" onClick={signOut} />
            </Menu>
          }
        />
      </Flex>
      {error && (
        <Card tone="critical" padding={3} radius={2} border>
          <Flex align="center" gap={2}>
            <Box flex={1}>
              <Text size={1}>{error}</Text>
            </Box>
            <Button mode="bleed" text="Dismiss" onClick={() => setError('')} />
          </Flex>
        </Card>
      )}
      <Box id="filespin-panel" role="tabpanel">
        {overlay}
        <div hidden={!!overlay}>{list}</div>
      </Box>
    </Stack>
  )
}
