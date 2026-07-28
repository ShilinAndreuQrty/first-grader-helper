import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createHashRouter } from '@vkontakte/vk-mini-apps-router'
import { render, screen } from '@testing-library/react'

import { App } from './App'
import { PANEL_PATHS } from './router'

describe('App', () => {
  it('renders the community disclaimer', async () => {
    const router = createHashRouter([
      { path: PANEL_PATHS.home, view: 'main', panel: 'home' },
    ])
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <RouterProvider router={router}>
        <QueryClientProvider client={client}>
          <App />
        </QueryClientProvider>
      </RouterProvider>,
    )

    expect(
      await screen.findByText(/не заменяет официальные сообщения ТулГУ/i),
    ).toBeInTheDocument()
  })
})
