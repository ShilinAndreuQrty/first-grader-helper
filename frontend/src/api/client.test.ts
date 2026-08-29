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

  it('restores the local session after an unauthorized response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ csrf_token: 'restored-token', mode: 'development' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(
      apiRequest<void>('/me/groups/by-code', {
        method: 'POST',
        body: JSON.stringify({ code: '221461', is_primary: true }),
      }),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toEqual(
      expect.stringMatching(/\/api\/auth\/dev$/),
    )
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).get('X-CSRF-Token'),
    ).toBe('restored-token')
  })
})
