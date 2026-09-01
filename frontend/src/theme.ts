import { useEffect, useState } from 'react'

export type AppColorScheme = 'light' | 'dark'
const THEME_STORAGE_KEY = 'ipmkn.theme'

export function resolveAppColorScheme(
  search: string = window.location.search,
  prefersDark: boolean = window.matchMedia?.('(prefers-color-scheme: dark)').matches ??
    false,
  storedTheme: string | null = localStorage.getItem(THEME_STORAGE_KEY),
): AppColorScheme {
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme
  const launchScheme = new URLSearchParams(search).get('vk_color_scheme')
  if (launchScheme) {
    return /dark|space_gray/i.test(launchScheme) ? 'dark' : 'light'
  }
  return prefersDark ? 'dark' : 'light'
}

export function applyAppTheme(colorScheme: AppColorScheme): void {
  document.documentElement.dataset.appTheme = colorScheme
  document.documentElement.style.colorScheme = colorScheme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', colorScheme === 'dark' ? '#19191a' : '#f3f5f8')
}

export const appColorScheme = resolveAppColorScheme()

export function useAppColorScheme(): {
  colorScheme: AppColorScheme
  toggleColorScheme: () => void
} {
  const [colorScheme, setColorScheme] = useState(resolveAppColorScheme)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const launchScheme = new URLSearchParams(window.location.search).get(
      'vk_color_scheme',
    )

    applyAppTheme(colorScheme)
    if (localStorage.getItem(THEME_STORAGE_KEY) || launchScheme || !media) return

    const handleChange = () => setColorScheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [colorScheme])

  const toggleColorScheme = () => {
    const nextTheme = colorScheme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    setColorScheme(nextTheme)
  }

  return { colorScheme, toggleColorScheme }
}
