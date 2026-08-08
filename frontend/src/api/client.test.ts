import { apiRequest } from './client'

describe('apiRequest', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('accepts a successful 204 response without parsing JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    )

    await expect(apiRequest<void>('/empty', { method: 'DELETE' })).resolves.toBe(
      undefined,
    )
  })

  it('uses the CSRF token shared between browser tabs', async () => {
    localStorage.setItem('ipmkn.csrf', 'shared-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    )

    await apiRequest<void>('/onboarding/step', {
      method: 'PUT',
      body: JSON.stringify({ completed: true }),
    })

    const request = fetchMock.mock.calls[0][1]
    expect(new Headers(request?.headers).get('X-CSRF-Token')).toBe(
      'shared-token',
    )
  })
})
