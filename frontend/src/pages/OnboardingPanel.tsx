import {
  Icon20ChevronRight,
  Icon24CheckCircleOn,
  Icon24DoorArrowRightOutline,
  Icon24InfoCircleOutline,
  Icon24ChainOutline,
  Icon24PlaceOutline,
  Icon24Users3Outline,
} from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Button,
  Checkbox,
  Div,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Text,
  Title,
} from '@vkontakte/vkui'
import type { CSSProperties, ReactNode } from 'react'

import {
  getOnboarding,
  OnboardingStep,
  setStepCompleted,
} from '../api/onboarding'
import { PANEL_PATHS } from '../router'

const STEP_ICONS: Record<string, ReactNode> = {
  'find-tutor': <Icon24Users3Outline />,
  'get-pass': <Icon24DoorArrowRightOutline />,
  'find-office': <Icon24PlaceOutline />,
  'learn-union': <Icon24InfoCircleOutline />,
  'check-events': <Icon24CheckCircleOn />,
  'save-links': <Icon24ChainOutline />,
}

export function OnboardingPanel({ id = 'onboarding' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const queryClient = useQueryClient()
  const steps = useQuery({ queryKey: ['onboarding'], queryFn: getOnboarding })
  const progress = useMutation({
    mutationFn: ({
      stepId,
      completed,
    }: {
      stepId: string
      completed: boolean
    }) => setStepCompleted(stepId, completed),
    onMutate: async ({ stepId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['onboarding'] })
      const previous = queryClient.getQueryData<OnboardingStep[]>(['onboarding'])
      queryClient.setQueryData<OnboardingStep[]>(
        ['onboarding'],
        (current) =>
          current?.map((step) =>
            step.id === stepId ? { ...step, completed } : step,
          ),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['onboarding'], context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
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
        Маршрут первака
      </PanelHeader>
      <Div className="onboarding-page">
        {isFinished ? (
          <section className="onboarding-finished">
            <span className="onboarding-finished__icon">
              <Icon24CheckCircleOn width={40} height={40} />
            </span>
            <Title level="1">База собрана!</Title>
            <Text>
              Вы разобрались с основными вещами. Маршрут больше не будет
              занимать место на главной, но сюда всегда можно вернуться.
            </Text>
            <Button size="l" onClick={() => void navigator.push(PANEL_PATHS.home)}>
              На главную
            </Button>
          </section>
        ) : (
          <>
            <section className="onboarding-hero">
              <div className="onboarding-hero__copy">
                <Text className="eyebrow">Короткий чек-лист</Text>
                <Title level="1">Освоиться в ИПМКН</Title>
                <Text>
                  Только то, что пригодится в первые недели. Отмечайте
                  сделанное — прогресс сохранится автоматически.
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

            <section className="onboarding-checklist" aria-label="Шаги маршрута">
              {steps.data?.map((step, index) => (
                <article
                  key={step.id}
                  className={`onboarding-step${step.completed ? ' onboarding-step--completed' : ''}`}
                >
                  <Checkbox
                    className="onboarding-step__checkbox"
                    aria-label={step.title}
                    checked={step.completed}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      progress.mutate({
                        stepId: step.id,
                        completed: event.target.checked,
                      })
                    }
                  />
                  <button
                    type="button"
                    className="onboarding-step__main"
                    aria-pressed={step.completed}
                    onClick={() =>
                      progress.mutate({
                        stepId: step.id,
                        completed: !step.completed,
                      })
                    }
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
