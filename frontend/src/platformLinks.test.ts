import { afterEach, describe, expect, it, vi } from 'vitest'

const bridgeMock = vi.hoisted(() => ({
  isEmbedded: vi.fn(() => false),
  send: vi.fn(() => Promise.resolve({ result: true })),
  supportsAsync: vi.fn(() => Promise.resolve(false)),
}))

vi.mock('@vkontakte/vk-bridge', () => ({ default: bridgeMock }))

import { openExternalUrl } from './platformLinks'

afterEach(() => {
  vi.restoreAllMocks()
  bridgeMock.isEmbedded.mockReturnValue(false)
  bridgeMock.send.mockClear()
  bridgeMock.supportsAsync.mockResolvedValue(false)
})

describe('openExternalUrl', () => {
  it('rejects unsafe and malformed URLs', async () => {
    const open = vi.spyOn(window, 'open')

    await expect(openExternalUrl('javascript:alert(1)')).resolves.toBe(false)
    await expect(openExternalUrl('not a url')).resolves.toBe(false)
    expect(open).not.toHaveBeenCalled()
  })

  it('uses the documented Bridge action for VK Mini Apps', async () => {
    bridgeMock.isEmbedded.mockReturnValue(true)
    bridgeMock.supportsAsync.mockResolvedValue(true)

    await expect(openExternalUrl('https://vk.ru/app12345')).resolves.toBe(true)
    expect(bridgeMock.send).toHaveBeenCalledWith('VKWebAppOpenApp', {
      app_id: 12345,
    })
  })

  it('opens regular links with the safe browser fallback', async () => {
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue({} as Window)

    await expect(openExternalUrl('https://tulsu.ru/')).resolves.toBe(true)
    expect(open).toHaveBeenCalledWith(
      'https://tulsu.ru/',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
