import {useCallback, useEffect, useRef, useState} from 'react'
import {NotAuthorizedError, SearchExpiredError} from '../api/client'
import type {Page} from '../api/types'

interface PagedState<T> {
  items: T[]
  page: number
  totalPages: number
  total: number
  loading: boolean
  error: Error | null
}

/**
 * First pages already fetched this session, by query. Reopening the picker
 * shows them at once while a fresh copy loads. Memory only: nothing about the
 * library is written to the browser's storage.
 */
const firstPages = new Map<string, Page<unknown>>()

/** Forget every saved page (on sign-out, so the next account never sees them). */
export function clearPageCache() {
  firstPages.clear()
}

/**
 * Paged results for a query. A new query replaces one still loading (the
 * older answer is dropped), so switching tabs or filters never waits.
 *
 * @param key       What makes it a new query (also the cache key).
 * @param fetchPage page, previous search id -> a page
 */
export function usePaged<T>(key: string, fetchPage: (page: number, sid: string) => Promise<Page<T>>) {
  const [state, setState] = useState<PagedState<T>>({
    items: [],
    page: 0,
    totalPages: 0,
    total: 0,
    loading: true,
    error: null,
  })
  const seq = useRef(0)
  const sid = useRef('')
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage

  const load = useCallback(
    (page: number) => {
      const mine = ++seq.current
      const saved = page === 1 ? (firstPages.get(key) as Page<T> | undefined) : undefined
      if (saved) {
        sid.current = saved.sid || ''
        setState({...saved, loading: false, error: null})
      } else {
        setState((s) => ({...s, items: page === 1 ? [] : s.items, loading: true, error: null}))
      }
      fetchRef
        .current(page, page === 1 ? '' : sid.current)
        .then((res) => {
          if (mine !== seq.current) return
          sid.current = res.sid || ''
          if (page === 1) firstPages.set(key, res as Page<unknown>)
          setState((s) => ({
            items: page === 1 ? res.items : [...s.items, ...res.items],
            page: res.page || page,
            totalPages: res.totalPages || 0,
            total: res.total || 0,
            loading: false,
            error: null,
          }))
        })
        .catch((error: Error) => {
          if (mine !== seq.current) return
          // A saved search the server dropped (after an hour): start again.
          if (error instanceof SearchExpiredError) {
            firstPages.delete(key)
            load(1)
            return
          }
          // A saved page stays up if the refresh fails; "signed out" replaces it.
          if (!saved || error instanceof NotAuthorizedError) {
            setState((s) => ({...s, loading: false, error}))
          }
        })
    },
    [key],
  )

  useEffect(() => {
    sid.current = ''
    load(1)
    return () => {
      seq.current++ // drop any answer still on its way
    }
  }, [load])

  return {
    ...state,
    more: state.page < state.totalPages && !state.loading ? () => load(state.page + 1) : null,
    reload: () => {
      firstPages.delete(key)
      load(1)
    },
  }
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
