import { useEffect, useState } from 'react'

// The preference is tri-state, but CSS only ever sees a resolved light/dark on
// <html data-theme>. That keeps the dark palette written exactly once, with no
// prefers-color-scheme duplicate to drift out of sync.

const KEY = 'tacoTheme_v2'
const LEGACY_KEY = 'tacoTheme_v1'
const CHROME = { light: '#FBF3E7', dark: '#1E1517' }

export const THEME_CYCLE = ['system', 'light', 'dark']
export const THEME_ICON = { system: '🖥️', light: '☀️', dark: '🌙' }
export const THEME_LABEL = { system: 'Match system theme', light: 'Light theme', dark: 'Dark theme' }

function readPref() {
  try {
    // v1 only ever held 'light' or 'dark', both valid here, so existing users
    // carry over without noticing.
    return localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || 'system'
  } catch {
    return 'system'
  }
}

export function useTheme() {
  const [pref, setPref] = useState(readPref)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useEffect(() => {
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      /* private mode — the theme just won't persist */
    }
    document.documentElement.dataset.theme = resolved
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = CHROME[resolved]
  }, [pref, resolved])

  function cycleTheme() {
    setPref((p) => THEME_CYCLE[(THEME_CYCLE.indexOf(p) + 1) % THEME_CYCLE.length])
  }

  return { pref, resolved, cycleTheme }
}
