import { useEffect, useRef, useState } from 'react'

import { CampusBuilding } from '../api/campus'
import { MapMode, resolveMapMode } from '../mapMode'

const DGIS_ENABLED = import.meta.env.VITE_DGIS_ENABLED === 'true'
const MAP_KEY = import.meta.env.VITE_DGIS_MAPGL_KEY
const FLOORS_LOADER_URL = 'https://floors-widget.api.2gis.ru/loader.js'
const FLOORS_INIT_TIMEOUT_MS = 10_000

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

interface FloorsWidgetInstance {
  on: (type: 'init', handler: () => void) => void
  off: () => void
}

interface FloorsApi {
  FloorsWidget: {
    init: (options: Record<string, unknown>) => FloorsWidgetInstance
  }
}

declare global {
  interface Window {
    DG?: FloorsApi
  }
}

let floorsLoaderPromise: Promise<FloorsApi> | undefined

function loadFloorsApi(): Promise<FloorsApi> {
  if (window.DG?.FloorsWidget) return Promise.resolve(window.DG)
  if (floorsLoaderPromise) return floorsLoaderPromise

  const loader = new Promise<FloorsApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${FLOORS_LOADER_URL}"]`,
    )
    const script = existing ?? document.createElement('script')

    const handleLoad = () => {
      if (window.DG?.FloorsWidget) {
        resolve(window.DG)
      } else {
        reject(new Error('FloorsJS loaded without a widget API'))
      }
    }
    const handleError = () => reject(new Error('FloorsJS failed to load'))

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    if (!existing) {
      script.src = FLOORS_LOADER_URL
      script.charset = 'utf-8'
      script.id = 'dg-floors-widget-loader'
      document.head.append(script)
    }
  })
  floorsLoaderPromise = loader.catch((error) => {
    floorsLoaderPromise = undefined
    throw error
  })

  return floorsLoaderPromise
}

function fallbackMessage(mode: MapMode): string {
  if (mode === 'disabled') {
    return 'Интерактивная карта отключена. Каталог и проверенная ссылка на 2ГИС остаются доступны.'
  }
  if (mode === 'missing-coordinates') {
    return 'Координаты или этажи пока не подтверждены. Используйте проверенную страницу объекта в 2ГИС.'
  }
  return 'Ключ MapGL не настроен. Используйте проверенную страницу объекта в 2ГИС.'
}

export function MapCanvas({ building }: { building: CampusBuilding }) {
  const container = useRef<HTMLDivElement>(null)
  const mode = resolveMapMode(building, DGIS_ENABLED, MAP_KEY)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (mode !== 'floors' && mode !== 'mapgl') return

    const mapContainer = container.current
    if (!mapContainer) return
    let disposed = false
    let map: MapInstance | undefined
    let floors: FloorsWidgetInstance | undefined
    let initTimer: number | undefined

    const fail = () => {
      if (!disposed) {
        floors?.off()
        map?.destroy()
        mapContainer.replaceChildren()
        setState('error')
      }
    }

    if (mode === 'floors') {
      // FloorsJS has no documented error event, so a timeout protects the
      // screen when a once-valid complexId stops serving an indoor plan.
      void loadFloorsApi()
        .then((api) => {
          if (disposed) return
          floors = api.FloorsWidget.init({
            container: mapContainer,
            width: '100%',
            height: '100%',
            initData: {
              complexId: building.dgis_complex_id,
              options: { locale: 'ru_RU', rotatable: false },
            },
          })
          floors.on('init', () => {
            if (!disposed) setState('ready')
            window.clearTimeout(initTimer)
          })
          initTimer = window.setTimeout(fail, FLOORS_INIT_TIMEOUT_MS)
        })
        .catch(fail)
    } else {
      // MapGL remains an optional bundle and is requested only for a verified
      // point after the user opens the campus screen.
      void import('@2gis/mapgl')
        .then((loadedModule) => {
          if (disposed) return
          const mapgl = loadedModule as unknown as MapGlModule
          const coordinates: [number, number] = [
            building.longitude!,
            building.latitude!,
          ]
          map = new mapgl.Map(mapContainer, {
            center: coordinates,
            zoom: 18,
            key: MAP_KEY,
            floorControl: true,
            disableDragging: true,
            enableTwoFingerDragging: true,
          })
          new mapgl.Marker(map, { coordinates })
          setState('ready')
        })
        .catch(fail)
    }

    return () => {
      disposed = true
      window.clearTimeout(initTimer)
      floors?.off()
      map?.destroy()
      mapContainer.replaceChildren()
    }
  }, [building, mode])

  if (mode !== 'floors' && mode !== 'mapgl') {
    return <div className="map-fallback">{fallbackMessage(mode)}</div>
  }

  return (
    <div className="map-shell">
      <div
        ref={container}
        className="map-canvas"
        aria-label={
          mode === 'floors' ? 'Поэтажная схема 2ГИС' : 'Карта 2ГИС'
        }
      />
      {state === 'loading' && (
        <div className="map-status" role="status">
          Загружаем карту…
        </div>
      )}
      {state === 'error' && (
        <div className="map-status map-status--error" role="alert">
          Карта 2ГИС не загрузилась. Откройте проверенную страницу объекта по
          кнопке ниже.
        </div>
      )}
    </div>
  )
}
