import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createHashRouter } from '@vkontakte/vk-mini-apps-router'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { AdminPanel, AdminUsersPanel } from './AdminPanel'

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
    expect(
      screen.getByRole('link', { name: 'Открыть публичное приложение' }),
    ).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('shows every tracked public-app user with useful activity details', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      if (url.endsWith('/admin/dashboard')) {
        return Promise.resolve(new Response(JSON.stringify({
          upcoming_events: 0,
          active_registrations: 0,
          event_participants: 0,
          cancelled_events: 0,
          total_users: 1,
          new_users_7d: 1,
          active_users_7d: 1,
          feedback_total: 0,
          new_feedback: 0,
        }), { status: 200 }))
      }
      if (url.endsWith('/admin/users')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'user-1',
          vk_user_id: 123456,
          display_name: 'Иван Иванов',
          profile_url: 'https://vk.ru/id123456',
          primary_group: '221461',
          first_login_at: '2026-08-20T08:00:00Z',
          last_activity_at: '2026-08-29T08:30:00Z',
          launch_count: 4,
        }]), { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 404 }))
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={client}>
        <AdminUsersPanel id="users" />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Иван Иванов')).toBeInTheDocument()
    expect(screen.getByText('VK ID 123456')).toBeInTheDocument()
    expect(screen.getByText('Запусков: 4')).toBeInTheDocument()
    expect(screen.getByText('зарегистрированных пользователей')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
