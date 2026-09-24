import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'hm-theme'

function read(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

/** Call once before first render to avoid a flash of the wrong theme. */
export function initTheme() {
  applyTheme(read())
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read)
  useEffect(() => applyTheme(choice), [choice])
  const cycle = useCallback(() => {
    setChoice((c) => {
      const next: ThemeChoice = c === 'system' ? 'light' : c === 'light' ? 'dark' : 'system'
      try {
        if (next === 'system') window.localStorage.removeItem(KEY)
        else window.localStorage.setItem(KEY, next)
      } catch {
        /* storage unavailable: theme still applies for this visit */
      }
      return next
    })
  }, [])
  return { choice, cycle }
}
