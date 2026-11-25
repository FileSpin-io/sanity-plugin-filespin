/**
 * Sign in with FileSpin: a new tab opens FileSpin's approval page with a short
 * code filled in; the editor signs in there and presses Allow, and this
 * screen notices by itself. No API key, no admin set-up.
 */

import {useEffect, useRef, useState} from 'react'
import {Box, Button, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {Code} from '@sanity/ui/code'
import {LaunchIcon} from '@sanity/icons/Launch'
import {useFileSpin} from './FileSpinProvider'
import {FileSpinIcon} from './FileSpinIcon'
import {requestDeviceCode, SignInError, waitForApproval, type DeviceAuthorization} from '../auth/deviceFlow'

export function SignIn() {
  const {config, store} = useFileSpin()
  const [auth, setAuth] = useState<DeviceAuthorization | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const start = async () => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setError('')
    setStarting(true)
    // Open the tab now, inside the click, or the browser blocks it as a pop-up.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null // the FileSpin page must not reach back into the Studio
    try {
      const a = await requestDeviceCode(config)
      if (ctrl.signal.aborted) return
      const link = a.verification_uri_complete || a.verification_uri
      if (tab && !tab.closed) tab.location.href = link
      setAuth(a)
      setStarting(false)
      const tokens = await waitForApproval(config, a, ctrl.signal)
      store.saveTokens(tokens)
    } catch (e) {
      tab?.close()
      if (e instanceof SignInError && e.reason === 'cancelled') return
      setError(e instanceof Error ? e.message : 'Sign-in failed.')
      setAuth(null)
      setStarting(false)
    }
  }

  const cancel = () => {
    abort.current?.abort()
    setAuth(null)
  }

  const link = auth ? auth.verification_uri_complete || auth.verification_uri : ''

  return (
    <Flex align="center" justify="center" padding={4} style={{minHeight: 320}}>
      <Stack gap={4} style={{maxWidth: 380, textAlign: 'center'}}>
        <Text size={4}>
          <FileSpinIcon />
        </Text>
        {!auth ? (
          <>
            <Stack gap={3}>
              <Text size={2} weight="semibold">
                Add images and videos from FileSpin
              </Text>
              <Text size={1} muted>
                Sign in with your FileSpin account. You see what your account can see in FileSpin, and files stay
                in FileSpin.
              </Text>
            </Stack>
            {error && (
              <Card tone="critical" padding={3} radius={2} border>
                <Text size={1}>{error}</Text>
              </Card>
            )}
            <Button
              tone="primary"
              text={starting ? 'Opening FileSpin…' : 'Sign in to FileSpin'}
              disabled={starting}
              onClick={start}
            />
            <Text size={1} muted>
              No FileSpin account?{' '}
              <a href={config.signupUrl} target="_blank" rel="noopener noreferrer">
                Sign up
              </a>
            </Text>
          </>
        ) : (
          <>
            <Stack gap={3}>
              <Text size={2} weight="semibold">
                Finish signing in on the FileSpin tab
              </Text>
              <Text size={1} muted>
                Sign in there and press Allow. Check that the page shows this code:
              </Text>
            </Stack>
            <Card padding={3} radius={2} tone="primary" border>
              <Code size={3}>{auth.user_code}</Code>
            </Card>
            <Flex align="center" justify="center" gap={2}>
              <Spinner muted />
              <Text size={1} muted>
                Waiting for you to allow access…
              </Text>
            </Flex>
            <Flex gap={2} justify="center" wrap="wrap">
              <Button
                as="a"
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                mode="ghost"
                icon={LaunchIcon}
                text="Open the FileSpin page again"
              />
              <Button mode="bleed" text="Cancel" onClick={cancel} />
            </Flex>
          </>
        )}
        <Box />
      </Stack>
    </Flex>
  )
}
