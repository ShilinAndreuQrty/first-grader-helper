import { CampusBuilding } from './api/campus'

const MAP_TARGET_KEY = 'ipmkn.mapTargetRoom'

export function normalizeCampusLocation(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[.,()№]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function aliasMatchesLocation(value: string, alias: string): boolean {
  const location = normalizeCampusLocation(value)
  const candidate = normalizeCampusLocation(alias)
  if (!candidate) return false
  return (
    location === candidate ||
    location.startsWith(`${candidate}-`) ||
    location.startsWith(`${candidate} `)
  )
}

export function matchBuildingByLocation(
  location: string,
  buildings: CampusBuilding[],
): CampusBuilding | undefined {
  return buildings.find((building) =>
    building.aliases.some((alias) => aliasMatchesLocation(location, alias)),
  )
}

export function buildingMatchesQuery(
  building: CampusBuilding,
  query: string,
): boolean {
  const normalized = normalizeCampusLocation(query)
  if (!normalized) return true
  const searchable = normalizeCampusLocation(
    [
      building.name,
      building.short_name,
      building.building_number,
      building.address,
      ...building.rooms.flatMap((room) => [room.room_number, room.title]),
    ].join(' '),
  )
  return (
    searchable.includes(normalized) ||
    building.aliases.some((alias) => aliasMatchesLocation(query, alias))
  )
}

export function setMapTargetRoom(room: string): void {
  sessionStorage.setItem(MAP_TARGET_KEY, room)
}

export function consumeMapTargetRoom(): string {
  const value = sessionStorage.getItem(MAP_TARGET_KEY) ?? ''
  sessionStorage.removeItem(MAP_TARGET_KEY)
  return value
}
