import { CampusBuilding } from './api/campus'

export type MapMode =
  | 'disabled'
  | 'floors'
  | 'mapgl'
  | 'widget'
  | 'missing-coordinates'
  | 'missing-embed'

export function resolveMapMode(
  building: CampusBuilding,
  enabled: boolean,
  mapKey?: string,
): MapMode {
  if (!enabled) return 'disabled'
  if (building.dgis_complex_id) return 'floors'
  if (building.latitude === null || building.longitude === null) {
    return 'missing-coordinates'
  }
  if (!mapKey) {
    const hasOrganizationCard = building.dgis_url.includes('/firm/')
    const hasKnownOrganizationMatch =
      building.dgis_object_id === '70030076867233638'
    return hasOrganizationCard || hasKnownOrganizationMatch
      ? 'widget'
      : 'missing-embed'
  }
  return 'mapgl'
}
