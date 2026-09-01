import { lazy, Suspense, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { getOnboarding, setStepCompleted } from './api/onboarding'

const ONBOARDING_PANEL_STEPS: Partial<Record<string, string>> = {
  schedule: 'open-schedule',
  map: 'explore-map',
  events: 'open-events',
  resources: 'open-resources',
}

function OnboardingProgressTracker({ panel }: { panel: string }) {
  const queryClient = useQueryClient()
  const attemptedSteps = useRef(new Set<string>())
  const steps = useQuery({ queryKey: ['onboarding'], queryFn: getOnboarding })

  useEffect(() => {
    const slug = ONBOARDING_PANEL_STEPS[panel]
    const step = steps.data?.find((item) => item.slug === slug)
    if (!step || step.completed || attemptedSteps.current.has(step.id)) return

    attemptedSteps.current.add(step.id)
    void setStepCompleted(step.id, true)
      .catch(() => attemptedSteps.current.delete(step.id))
      .finally(() => queryClient.invalidateQueries({ queryKey: ['onboarding'] }))
  }, [panel, queryClient, steps.data])

  return null
}

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
  const { colorScheme, toggleColorScheme } = useAppColorScheme()

  return (
    <ConfigProvider colorScheme={colorScheme}>
      <AdaptivityProvider>
        <AppRoot>
          <OnboardingProgressTracker panel={panel} />
          <Epic
            activeStory="main"
            tabbar={<AppTabbar activePanel={panel} />}
          >
            <View id="main" activePanel={panel}>
              <HomePanel id="home" />
              <SchedulePanel id="schedule" />
              <EventsPanel id="events" />
              <AssistantPanel id="assistant" />
              <MorePanel
                id="more"
                colorScheme={colorScheme}
                onToggleColorScheme={toggleColorScheme}
              />
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
