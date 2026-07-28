import { useEffect, useRef } from 'react'

import { CampusBuilding } from '../api/campus'

const MAP_KEY = import.meta.env.VITE_DGIS_MAPGL_KEY

interface MapInstance {
  destroy: () => void
}

interface MapGlModule {
  Map: new (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => MapInstance
  Marker: new (
    map: MapInstance,
    options: { coordinates: [number, number] },
  ) => unknown
}

export function MapCanvas({ building }: { building: CampusBuilding }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (
      !MAP_KEY ||
      building.latitude === null ||
      building.longitude === null ||
      !container.current
    ) {
      return
    }
    let disposed = false
    let map: MapInstance | undefined

    // MapGL is a large optional dependency, so it is downloaded only when a
    // verified point can actually be displayed.
    void import('@2gis/mapgl').then((loadedModule) => {
      if (disposed || !container.current) return
      const mapgl = loadedModule as unknown as MapGlModule
      const coordinates: [number, number] = [
        building.longitude!,
        building.latitude!,
      ]
      map = new mapgl.Map(container.current, {
        center: coordinates,
        zoom: 17,
        key: MAP_KEY,
        floorControl: true,
        disableDragging: true,
        enableTwoFingerDragging: true,
      })
      new mapgl.Marker(map, { coordinates })
    })

    return () => {
      disposed = true
      map?.destroy()
    }
  }, [building])

  if (!MAP_KEY) {
    return (
      <div className="map-fallback">
        Интерактивная карта отключена: ключ 2ГИС не настроен.
      </div>
    )
  }
  if (building.latitude === null || building.longitude === null) {
    return (
      <div className="map-fallback">
        Координаты ещё не проверены. Используйте ссылку на 2ГИС.
      </div>
    )
  }
  return <div ref={container} className="map-canvas" aria-label="Карта 2ГИС" />
}
