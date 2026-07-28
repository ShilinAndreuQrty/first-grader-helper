import { lazy, Suspense } from 'react'
import {
  AdaptivityProvider,
  AppRoot,
  ConfigProvider,
  Epic,
  View,
} from '@vkontakte/vkui'
import { useActiveVkuiLocation } from '@vkontakte/vk-mini-apps-router'

import { AppTabbar } from './components/AppTabbar'
import { AssistantPanel } from './pages/AssistantPanel'
import { EventsPanel } from './pages/EventsPanel'
import { HomePanel } from './pages/HomePanel'
import { MorePanel } from './pages/MorePanel'
import { SchedulePanel } from './pages/SchedulePanel'

const AdminPanel = lazy(() =>
  import('./pages/AdminPanel').then((module) => ({
    default: module.AdminPanel,
  })),
)
const MapPanel = lazy(() =>
  import('./pages/MapPanel').then((module) => ({
    default: module.MapPanel,
  })),
)

function LazyAdminPanel({ id }: { id: string }) {
  return (
    <Suspense fallback={<div aria-label="Загрузка админ-панели" />}>
      <AdminPanel id={id} />
    </Suspense>
  )
}

function LazyMapPanel({ id }: { id: string }) {
  return (
    <Suspense fallback={<div aria-label="Загрузка карты" />}>
      <MapPanel id={id} />
    </Suspense>
  )
}

export function App() {
  const { panel = 'home' } = useActiveVkuiLocation()

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <Epic
            activeStory="main"
            tabbar={<AppTabbar activePanel={panel} />}
          >
            <View id="main" activePanel={panel}>
              <HomePanel id="home" />
              <SchedulePanel id="schedule" />
              <EventsPanel id="events" />
              <AssistantPanel id="assistant" />
              <MorePanel id="more" />
              <LazyAdminPanel id="admin" />
              <LazyMapPanel id="map" />
            </View>
          </Epic>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}
