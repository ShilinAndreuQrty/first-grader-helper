import { CampusBuilding } from './api/campus'

export type MapMode =
  | 'disabled'
  | 'floors'
  | 'mapgl'
  | 'missing-coordinates'
  | 'missing-key'

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
  if (!mapKey) return 'missing-key'
  return 'mapgl'
}
