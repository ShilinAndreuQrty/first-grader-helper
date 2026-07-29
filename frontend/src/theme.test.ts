import { describe, expect, it } from 'vitest'

import { resolveAppColorScheme } from './theme'

describe('app color scheme', () => {
  it('uses the VK launch scheme ahead of browser preferences', () => {
    expect(resolveAppColorScheme('?vk_color_scheme=client_dark', false)).toBe(
      'dark',
    )
    expect(resolveAppColorScheme('?vk_color_scheme=light', true)).toBe('light')
  })

  it('falls back to the browser preference outside VK', () => {
    expect(resolveAppColorScheme('', true)).toBe('dark')
    expect(resolveAppColorScheme('', false)).toBe('light')
  })
})
