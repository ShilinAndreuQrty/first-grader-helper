import { apiRequest } from './client'

export interface CampusRoom {
  id: string
  room_number: string
  title: string
  floor: string
  directions: string
  verified_at: string | null
}

export interface CampusBuilding {
  id: string
  slug: string
  name: string
  short_name: string
  kind: 'academic' | 'dormitory'
  building_number: string
  address: string
  entrance_hint: string
  aliases: string[]
  complex_slug: string
  dgis_url: string
  dgis_object_id: string
  dgis_complex_id: string | null
  source_url: string | null
  latitude: number | null
  longitude: number | null
  sort_order: number
  verified_at: string | null
  rooms: CampusRoom[]
}

export function getCampusBuildings(query?: string): Promise<CampusBuilding[]> {
  const suffix = query?.trim()
    ? `?query=${encodeURIComponent(query.trim())}`
    : ''
  return apiRequest(`/campus/buildings${suffix}`)
}
