import {useEffect, useEffectEvent, useRef, useState} from 'react'

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

interface Request {
  key: string
  page: number
  /** Bumped to fetch the same page again. */
  nonce: number
}

/**
 * First pages already fetched this session, by query. Reopening the picker
 * shows them at once while a fresh copy loads. Memory only: nothing about the
 * library is written to the browser's storage.
 */
const firstPages = new Map<string, Page<any>>()

/** Forget every saved page (on sign-out, so the next account never sees them). */
export function clearPageCache() {
  firstPages.clear()
}

function startState<T>(key: string): PagedState<T> {
  const saved: Page<T> | undefined = firstPages.get(key)
  return saved
    ? {
        items: saved.items,
        page: saved.page,
        totalPages: saved.totalPages,
        total: saved.total,
        loading: false,
        error: null,
      }
    : {items: [], page: 0, totalPages: 0, total: 0, loading: true, error: null}
}

/**
 * Paged results for a query. A new query replaces one still loading (the
 * older answer is dropped), so switching tabs or filters never waits.
 *
 * @param key       What makes it a new query (also the cache key).
 * @param fetchPage page, previous search id -> a page
 */
export function usePaged<T>(
  key: string,
  fetchPage: (page: number, sid: string) => Promise<Page<T>>,
) {
  const [req, setReq] = useState<Request>({key, page: 1, nonce: 0})
  const [state, setState] = useState<PagedState<T>>(() => startState<T>(key))
  const sid = useRef('')

  // A new query: start over, showing a saved first page at once if there is one.
  if (req.key !== key) {
    setReq({key, page: 1, nonce: req.nonce + 1})
    setState(startState<T>(key))
  }

  const fetchLatest = useEffectEvent((page: number, previous: string) => fetchPage(page, previous))

  useEffect(() => {
    let live = true
    const {key: k, page} = req
    void (async () => {
      try {
        const res = await fetchLatest(page, page === 1 ? '' : sid.current)
        if (!live) return
        sid.current = res.sid || ''
        if (page === 1) firstPages.set(k, res)
        setState((s) => ({
          items: page === 1 ? res.items : [...s.items, ...res.items],
          page: res.page || page,
          totalPages: res.totalPages || 0,
          total: res.total || 0,
          loading: false,
          error: null,
        }))
      } catch (e) {
        if (!live) return
        const error = e instanceof Error ? e : new Error(String(e))
        // A saved search the server dropped (after an hour): run it again.
        if (error instanceof SearchExpiredError) {
          firstPages.delete(k)
          setState(startState<T>(k))
          setReq((r) => ({...r, page: 1, nonce: r.nonce + 1}))
          return
        }
        // A saved first page stays up if its refresh fails; "signed out" replaces it.
        setState((s) =>
          page === 1 && s.items.length && !(error instanceof NotAuthorizedError)
            ? {...s, loading: false}
            : {...s, loading: false, error},
        )
      }
    })()
    return () => {
      live = false // drop an answer still on its way
    }
  }, [req])

  return {
    ...state,
    more:
      state.page < state.totalPages && !state.loading
        ? () => {
            setState((s) => ({...s, loading: true, error: null}))
            setReq((r) => ({...r, page: state.page + 1, nonce: r.nonce + 1}))
          }
        : null,
    reload: () => {
      firstPages.delete(key)
      setState(startState<T>(key))
      setReq((r) => ({...r, page: 1, nonce: r.nonce + 1}))
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
