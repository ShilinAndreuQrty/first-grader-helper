import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createHashRouter,
} from '@vkontakte/vk-mini-apps-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SchedulePanel } from './SchedulePanel'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SchedulePanel group search', () => {
  it('validates locally and does not present an outage as not found', async () => {
    const requests: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      requests.push(url)
      if (url.endsWith('/me/groups')) {
        return Promise.resolve(
          new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url.includes('/schedule/groups')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ detail: 'Расписание ТулГУ временно недоступно' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    window.location.hash = '#/schedule'
    const router = createHashRouter([
      { path: '/schedule', view: 'main', panel: 'schedule' },
    ])

    render(
      <RouterProvider router={router}>
        <QueryClientProvider client={client}>
          <SchedulePanel />
        </QueryClientProvider>
      </RouterProvider>,
    )

    const input = screen.getByPlaceholderText('Например, 220031-22')
    await user.type(input, 'ИВТ-101')
    expect(await screen.findByText('Проверьте формат номера')).toBeInTheDocument()
    expect(
      requests.some((url) => url.includes('/schedule/groups')),
    ).toBe(false)

    await user.clear(input)
    await user.type(input, '220031-22')

    expect(await screen.findByText('Поиск групп недоступен')).toBeInTheDocument()
    expect(screen.queryByText('Группа не найдена')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeEnabled()
  })
})
