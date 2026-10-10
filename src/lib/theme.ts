import { useCallback, useEffect, useState } from 'react'

// Light / dark: follows the phone or computer setting until the person
// presses the header switch; that choice is remembered in this browser only
// (a convenience, so storage failing — private mode — just means it resets).
export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'hanhs-log-theme'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (choice === 'system') delete root.dataset.theme
    else root.dataset.theme = choice
    try {
      if (choice === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, choice)
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
  }, [choice])

  const isDark = choice === 'dark' || (choice === 'system' && systemDark)
  const toggle = useCallback(() => setChoice(isDark ? 'light' : 'dark'), [isDark])
  return { isDark, toggle }
}
