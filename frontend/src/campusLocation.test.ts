import { describe, expect, it } from 'vitest'

import { CampusBuilding } from './api/campus'
import {
  aliasMatchesLocation,
  matchBuildingByLocation,
} from './campusLocation'

function building(id: string, aliases: string[]): CampusBuilding {
  return {
    id,
    slug: id,
    name: id,
    short_name: id,
    kind: 'academic',
    building_number: id,
    address: '',
    entrance_hint: '',
    aliases,
    complex_slug: '',
    dgis_url: 'https://2gis.ru/',
    dgis_object_id: id,
    dgis_complex_id: null,
    source_url: 'https://tulsu.ru/',
    latitude: null,
    longitude: null,
    sort_order: 0,
    verified_at: null,
    rooms: [],
  }
}

describe('campus location aliases', () => {
  it('normalizes schedule dashes and keeps building numbers exact', () => {
    expect(aliasMatchesLocation('Гл-401', 'гл')).toBe(true)
    expect(aliasMatchesLocation('9–311', '9')).toBe(true)
    expect(aliasMatchesLocation('10-205', '1')).toBe(false)
    expect(aliasMatchesLocation('10-205', '10')).toBe(true)
  })

  it('does not guess unknown schedule locations', () => {
    const buildings = [
      building('main', ['гл']),
      building('building-9', ['9']),
    ]

    expect(matchBuildingByLocation('Гл-401', buildings)?.id).toBe('main')
    expect(matchBuildingByLocation('дистанционно', buildings)).toBeUndefined()
  })
})
