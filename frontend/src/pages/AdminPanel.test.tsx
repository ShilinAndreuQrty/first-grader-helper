import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createHashRouter } from '@vkontakte/vk-mini-apps-router'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { AdminPanel } from './AdminPanel'

describe('AdminPanel', () => {
  it('shows a safe denied state for a student', async () => {
    window.location.hash = '#/admin'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 403 }),
    )
    const router = createHashRouter([
      { path: '/admin', view: 'main', panel: 'admin' },
    ])
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <RouterProvider router={router}>
        <QueryClientProvider client={client}>
          <AdminPanel id="admin" />
        </QueryClientProvider>
      </RouterProvider>,
    )

    expect(await screen.findByText('Нет доступа')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
