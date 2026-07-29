import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createHashRouter } from '@vkontakte/vk-mini-apps-router'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { MapPanel } from './MapPanel'

describe('MapPanel', () => {
  it('keeps the catalog useful without a MapGL key', async () => {
    window.location.hash = '#/map'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 'main',
            slug: 'main',
            name: 'Главный учебный корпус ТулГУ',
            short_name: 'Главный',
            building_number: 'Главный',
            address: 'Тула, проспект Ленина, 92',
            entrance_hint: '',
            aliases: ['гл', 'главный'],
            complex_slug: 'main-9',
            dgis_url: 'https://2gis.ru/tula/geo/5067185235966202',
            dgis_object_id: '5067185235966202',
            dgis_complex_id: null,
            source_url: 'https://tulsu.ru/facilities/academic-building/4',
            latitude: null,
            longitude: null,
            sort_order: 0,
            verified_at: null,
            rooms: [],
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const router = createHashRouter([
      { path: '/map', view: 'main', panel: 'map' },
    ])
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <RouterProvider router={router}>
        <QueryClientProvider client={client}>
          <MapPanel id="map" />
        </QueryClientProvider>
      </RouterProvider>,
    )

    expect(
      await screen.findByText('Главный учебный корпус ТулГУ'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/интерактивная карта отключена/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть в 2ГИС' })).toBeEnabled()
    vi.restoreAllMocks()
  })
})
