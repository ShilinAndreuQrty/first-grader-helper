import { CampusBuilding } from '../api/campus'
import { resolveMapMode } from '../mapMode'

const building: CampusBuilding = {
  id: 'main',
  slug: 'main',
  name: 'Главный корпус ТулГУ',
  short_name: 'Главный корпус',
  kind: 'academic',
  building_number: 'Главный',
  address: 'Тула, проспект Ленина, 92',
  entrance_hint: '',
  aliases: ['гл'],
  complex_slug: 'main-9',
  dgis_url: 'https://2gis.ru/tula/geo/5067185235966202',
  dgis_object_id: '5067185235966202',
  dgis_complex_id: '5067185235966202',
  source_url: 'https://tulsu.ru/facilities/academic-building/4',
  latitude: 54.166259,
  longitude: 37.586635,
  sort_order: 0,
  verified_at: null,
  rooms: [],
}

describe('resolveMapMode', () => {
  it('prefers a verified FloorsJS complex without a MapGL key', () => {
    expect(resolveMapMode(building, true, '')).toBe('floors')
  })

  it('uses MapGL only for verified coordinates and a key', () => {
    const withoutFloors = { ...building, dgis_complex_id: null }

    expect(resolveMapMode(withoutFloors, true, 'public-browser-key')).toBe(
      'mapgl',
    )
    expect(
      resolveMapMode(
        {
          ...withoutFloors,
          dgis_url: 'https://2gis.ru/tula/firm/5067533128372221',
        },
        true,
        '',
      ),
    ).toBe('widget')
    expect(resolveMapMode(withoutFloors, true, '')).toBe('missing-embed')
    expect(
      resolveMapMode(
        { ...withoutFloors, latitude: null, longitude: null },
        true,
        'public-browser-key',
      ),
    ).toBe('missing-coordinates')
  })

  it('keeps every remote integration behind the feature flag', () => {
    expect(resolveMapMode(building, false, 'public-browser-key')).toBe(
      'disabled',
    )
  })
})
