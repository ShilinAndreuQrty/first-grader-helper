import { apiRequest } from './client'

describe('apiRequest', () => {
  it('accepts a successful 204 response without parsing JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    )

    await expect(apiRequest<void>('/empty', { method: 'DELETE' })).resolves.toBe(
      undefined,
    )
    vi.restoreAllMocks()
  })
})
