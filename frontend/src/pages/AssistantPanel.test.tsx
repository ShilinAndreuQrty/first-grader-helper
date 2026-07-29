import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createHashRouter,
} from '@vkontakte/vk-mini-apps-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AssistantPanel } from './AssistantPanel'

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('AssistantPanel', () => {
  it('shows the complete FAQ response without technical source metadata', async () => {
    const entries = Array.from({ length: 13 }, (_, index) => ({
      id: `faq-${index + 1}`,
      question:
        index === 12 ? 'Тринадцатый опубликованный вопрос?' : `Вопрос ${index + 1}?`,
      answer_markdown: `Ответ ${index + 1}.`,
      category: 'Адаптация',
      source_url: null,
      verified_at: '2026-07-29T00:00:00Z',
      is_time_sensitive: false,
    }))
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      if (url.endsWith('/faq/categories')) {
        return Promise.resolve(
          new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url.endsWith('/faq')) {
        return Promise.resolve(
          new Response(JSON.stringify(entries), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url.endsWith('/assistant/query') && init?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              type: 'answer',
              answer: entries[0],
              message: 'Тьютор помогает первокурснику освоиться в вузе.',
              faq_ids: ['faq-1'],
              suggestions: [],
              confidence: 'high',
              sources: [
                {
                  title: 'Внутренняя запись',
                  url: null,
                  verified_at: '2026-07-29T00:00:00Z',
                },
              ],
              official_source: null,
              verified_at: '2026-07-29T00:00:00Z',
              mode: 'grounded_ai',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })
    const router = createHashRouter([
      { path: '/assistant', view: 'main', panel: 'assistant' },
    ])
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    window.location.hash = '#/assistant'

    render(
      <RouterProvider router={router}>
        <QueryClientProvider client={client}>
          <AssistantPanel />
        </QueryClientProvider>
      </RouterProvider>,
    )

    expect(
      await screen.findByText('Тринадцатый опубликованный вопрос?'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Кто такой тьютор?' }))
    expect(
      await screen.findByText('Тьютор помогает первокурснику освоиться в вузе.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Источники')).not.toBeInTheDocument()
    expect(screen.queryByText(/Проверено:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/faq-1/i)).not.toBeInTheDocument()
  })

  it('shows one official Tulsu link for the official fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      if (url.endsWith('/faq/categories') || url.endsWith('/faq')) {
        return Promise.resolve(
          new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url.endsWith('/assistant/query') && init?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              type: 'answer',
              answer: null,
              message:
                'Актуальный перечень общежитий и их адреса опубликован на официальной странице ТулГУ.',
              faq_ids: [],
              suggestions: [],
              confidence: 'medium',
              sources: [],
              official_source: {
                title: 'Общежития ТулГУ',
                url: 'https://tulsu.ru/facilities/dormitory',
              },
              verified_at: null,
              mode: 'official_tulsu',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })
    const router = createHashRouter([
      { path: '/assistant', view: 'main', panel: 'assistant' },
    ])
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    window.location.hash = '#/assistant'

    render(
      <RouterProvider router={router}>
        <QueryClientProvider client={client}>
          <AssistantPanel />
        </QueryClientProvider>
      </RouterProvider>,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Кому предоставляются места в общежитии?',
      }),
    )
    expect(
      await screen.findByRole('button', {
        name: 'Подробнее на официальном сайте ТулГУ',
      }),
    ).toBeEnabled()
    expect(screen.queryByText('Источники')).not.toBeInTheDocument()
  })
})
