import {useId} from 'react'

/**
 * The FileSpin mark (a circle split into two mirrored, fading halves) drawn in
 * the text colour, so it sits with Sanity's own icons in light and dark mode.
 *
 * @public
 */
export function FileSpinIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      data-sanity-icon="filespin"
      width="1em"
      height="1em"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}t`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path d="M4 12.5a8.5 8.5 0 0 1 17 0z" fill={`url(#${id}t)`} />
      <path d="M4 12.5h17a8.5 8.5 0 0 1-17 0z" fill={`url(#${id}b)`} />
    </svg>
  )
}
