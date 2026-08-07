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
            kind: 'academic',
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
            rooms: [
              {
                id: 'room-425',
                room_number: '425',
                title: 'Дирекция ИПМКН',
                floor: '4',
                directions: '',
                verified_at: null,
              },
              {
                id: 'room-123',
                room_number: '123',
                title: 'Профком',
                floor: '1',
                directions: '',
                verified_at: null,
              },
              {
                id: 'room-125',
                room_number: '125',
                title: 'Профком',
                floor: '1',
                directions: '',
                verified_at: null,
              },
            ],
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
      screen.getByText(/нет координат или этажей/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Главный и 9-й корпуса считаются отдельными корпусами/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Дирекция ИПМКН')).toBeInTheDocument()
    expect(screen.getByText('Гл-123 и Гл-125')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть в 2ГИС' })).toBeEnabled()
    vi.restoreAllMocks()
  })
})
