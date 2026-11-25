/**
 * Everything the FileSpin screens share: which FileSpin, the editor's login,
 * and the API client. One login per Sanity user, so every FileSpin field in
 * the Studio is signed in once the editor signs in on any of them.
 */

import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from 'react'
import {useCurrentUser, useProjectId} from 'sanity'
import type {ResolvedConfig} from '../config'
import {sessionStore, type Session, type SessionStore} from '../auth/session'
import {FileSpinClient} from '../api/client'

interface FileSpinContextValue {
  config: ResolvedConfig
  store: SessionStore
  client: FileSpinClient
  session: Session | null
}

const Ctx = createContext<FileSpinContextValue | null>(null)

export function FileSpinProvider({config, children}: {config: ResolvedConfig; children: ReactNode}) {
  const projectId = useProjectId()
  const user = useCurrentUser()
  const store = useMemo(() => sessionStore(config, projectId, user?.id || 'anonymous'), [config, projectId, user?.id])
  const client = useMemo(() => new FileSpinClient(config, store), [config, store])
  const [session, setSession] = useState<Session | null>(() => store.get())

  useEffect(() => {
    setSession(store.get())
    return store.subscribe(setSession)
  }, [store])

  // Fill in the account line once per login.
  useEffect(() => {
    if (!session || session.email) return
    let live = true
    client
      .userinfo()
      .then((u) => {
        if (live && u.email) store.setEmail(u.email)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [client, session, store])

  const value = useMemo(() => ({config, store, client, session}), [config, store, client, session])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFileSpin(): FileSpinContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('FileSpin screens must be inside FileSpinProvider')
  return v
}
