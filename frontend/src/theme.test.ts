import { describe, expect, it } from 'vitest'

import { resolveAppColorScheme } from './theme'

describe('app color scheme', () => {
  it('uses the VK launch scheme ahead of browser preferences', () => {
    expect(resolveAppColorScheme('?vk_color_scheme=client_dark', false, null)).toBe(
      'dark',
    )
    expect(resolveAppColorScheme('?vk_color_scheme=light', true, null)).toBe('light')
  })

  it('falls back to the browser preference outside VK', () => {
    expect(resolveAppColorScheme('', true, null)).toBe('dark')
    expect(resolveAppColorScheme('', false, null)).toBe('light')
  })

  it('keeps an explicit user choice across launches', () => {
    expect(resolveAppColorScheme('?vk_color_scheme=light', false, 'dark')).toBe(
      'dark',
    )
  })
})
