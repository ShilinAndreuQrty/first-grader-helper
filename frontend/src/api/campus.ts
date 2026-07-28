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
  name: string
  short_name: string
  address: string
  entrance_hint: string
  dgis_url: string
  latitude: number | null
  longitude: number | null
  verified_at: string | null
  rooms: CampusRoom[]
}

export function getCampusBuildings(query?: string): Promise<CampusBuilding[]> {
  const suffix = query?.trim()
    ? `?query=${encodeURIComponent(query.trim())}`
    : ''
  return apiRequest(`/campus/buildings${suffix}`)
}

