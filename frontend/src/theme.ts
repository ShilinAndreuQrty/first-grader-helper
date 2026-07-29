export type AppColorScheme = 'light' | 'dark'

export function resolveAppColorScheme(
  search: string = window.location.search,
  prefersDark: boolean = window.matchMedia?.('(prefers-color-scheme: dark)').matches ??
    false,
): AppColorScheme {
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
