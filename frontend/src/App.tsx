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
import { LegalPanel } from './pages/LegalPanel'
import { MorePanel } from './pages/MorePanel'
import { OnboardingPanel } from './pages/OnboardingPanel'
import { SchedulePanel } from './pages/SchedulePanel'
import { SettingsPanel } from './pages/SettingsPanel'
import { ResourcesPanel } from './pages/ResourcesPanel'
import { useAppColorScheme } from './theme'

const MapPanel = lazy(() =>
  import('./pages/MapPanel').then((module) => ({
    default: module.MapPanel,
  })),
)

function LazyMapPanel({ id }: { id: string }) {
  return (
    <Suspense fallback={<div aria-label="Загрузка карты" />}>
      <MapPanel id={id} />
    </Suspense>
  )
}

export function App() {
  const { panel = 'home' } = useActiveVkuiLocation()
  const colorScheme = useAppColorScheme()

  return (
    <ConfigProvider colorScheme={colorScheme}>
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
              <LazyMapPanel id="map" />
              <SettingsPanel id="settings" />
              <OnboardingPanel id="onboarding" />
              <LegalPanel id="about" kind="about" />
              <LegalPanel id="privacy" kind="privacy" />
              <ResourcesPanel id="resources" />
            </View>
          </Epic>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}
