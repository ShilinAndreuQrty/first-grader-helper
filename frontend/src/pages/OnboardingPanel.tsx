import {
  Icon20ChevronRight,
  Icon24CheckCircleOn,
  Icon24ChainOutline,
  Icon24PlaceOutline,
  Icon24CalendarOutline,
  Icon24EducationOutline,
} from '@vkontakte/icons'
import { useQuery } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Button,
  Div,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Text,
  Title,
} from '@vkontakte/vkui'
import type { CSSProperties, ReactNode } from 'react'

import { getOnboarding } from '../api/onboarding'
import { getCurrentUser } from '../api/auth'
import { dismissOnboarding } from '../onboardingDismissal'
import { PANEL_PATHS } from '../router'

const STEP_ICONS: Record<string, ReactNode> = {
  'choose-group': <Icon24EducationOutline />,
  'open-schedule': <Icon24CalendarOutline />,
  'explore-map': <Icon24PlaceOutline />,
  'open-events': <Icon24CalendarOutline />,
  'open-resources': <Icon24ChainOutline />,
}

export function OnboardingPanel({ id = 'onboarding' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const steps = useQuery({ queryKey: ['onboarding'], queryFn: getOnboarding })
  const currentUser = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  })
  const completed = steps.data?.filter((step) => step.completed).length ?? 0
  const total = steps.data?.length ?? 0
  const percent = total ? Math.round((completed / total) * 100) : 0
  const isFinished = total > 0 && completed === total

  return (
    <Panel id={id} className="onboarding-panel">
      <PanelHeader
        before={
          <PanelHeaderBack
            aria-label="Назад"
            onClick={() => void navigator.back()}
          />
        }
      >
        Знакомство с приложением
      </PanelHeader>
      <Div className="onboarding-page">
        {isFinished ? (
          <section className="onboarding-finished">
            <span className="onboarding-finished__icon">
              <Icon24CheckCircleOn width={40} height={40} />
            </span>
            <Title level="1">База собрана!</Title>
            <Text>
              Вы посмотрели основные разделы. Чек-лист больше не будет
              занимать место на главной, но сюда всегда можно вернуться.
            </Text>
            <Button
              size="l"
              disabled={!currentUser.data}
              onClick={() => {
                if (currentUser.data) dismissOnboarding(currentUser.data.id)
                void navigator.push(PANEL_PATHS.home)
              }}
            >
              На главную
            </Button>
          </section>
        ) : (
          <>
            <section className="onboarding-hero">
              <div className="onboarding-hero__copy">
                <Text className="eyebrow">Короткий чек-лист</Text>
                <Title level="1">Пять полезных разделов</Title>
                <Text>
                  Быстро пройдитесь по возможностям приложения. Открывайте
                  разделы — прогресс сохранится автоматически.
                </Text>
              </div>
              <div
                className="onboarding-progress-ring"
                style={{ '--onboarding-progress': `${percent * 3.6}deg` } as CSSProperties}
                aria-label={`Выполнено ${completed} из ${total}`}
              >
                <strong>{completed}</strong>
                <small>из {total}</small>
              </div>
            </section>

            <section className="onboarding-checklist" aria-label="Знакомство с приложением">
              {steps.data?.map((step, index) => (
                <article
                  key={step.id}
                  className={`onboarding-step${step.completed ? ' onboarding-step--completed' : ''}`}
                >
                  <span
                    className={`onboarding-step__status${step.completed ? ' onboarding-step__status--completed' : ''}`}
                    role="img"
                    aria-label={step.completed ? 'Выполнено' : 'Не выполнено'}
                  />
                  <button
                    type="button"
                    className="onboarding-step__main"
                    disabled={!step.action_path || step.completed}
                    onClick={() => void navigator.push(step.action_path)}
                  >
                    <span className="onboarding-step__icon" aria-hidden>
                      {STEP_ICONS[step.slug] ?? <Icon24CheckCircleOn />}
                    </span>
                    <span className="onboarding-step__copy">
                      <small>Шаг {index + 1}</small>
                      <strong>{step.title}</strong>
                      <Text>{step.description}</Text>
                    </span>
                  </button>
                  {step.action_path && !step.completed && (
                    <button
                      type="button"
                      className="onboarding-step__action"
                      aria-label={`Открыть: ${step.title}`}
                      onClick={() => void navigator.push(step.action_path)}
                    >
                      <Icon20ChevronRight />
                    </button>
                  )}
                </article>
              ))}
            </section>
          </>
        )}
      </Div>
    </Panel>
  )
}
