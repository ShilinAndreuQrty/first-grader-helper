import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  Checkbox,
  Div,
  FormItem,
  Group,
  Header,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Progress,
  SimpleCell,
  Textarea,
} from '@vkontakte/vkui'
import { useState } from 'react'

import {
  getOnboarding,
  reportIssue,
  setStepCompleted,
} from '../api/onboarding'
import { PANEL_PATHS } from '../router'

export function OnboardingPanel({ id = 'onboarding' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const steps = useQuery({ queryKey: ['onboarding'], queryFn: getOnboarding })
  const progress = useMutation({
    mutationFn: ({
      stepId,
      completed,
    }: {
      stepId: string
      completed: boolean
    }) => setStepCompleted(stepId, completed),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
  })
  const issue = useMutation({
    mutationFn: () => reportIssue('onboarding', message.trim()),
    onSuccess: () => setMessage(''),
  })
  const completed = steps.data?.filter((step) => step.completed).length ?? 0
  const total = steps.data?.length ?? 0

  return (
    <Panel id={id}>
      <PanelHeader
        before={
          <PanelHeaderBack
            aria-label="Назад"
            onClick={() => void navigator.push(PANEL_PATHS.home)}
          />
        }
      >
        Маршрут первокурсника
      </PanelHeader>
      <Group>
        <Div className="onboarding-progress">
          <Progress value={total ? (completed / total) * 100 : 0} />
          <span>
            {completed} из {total} шагов
          </span>
        </Div>
      </Group>
      <Group header={<Header>Чек-лист</Header>}>
        {steps.data?.map((step) => (
          <SimpleCell
            key={step.id}
            multiline
            subtitle={step.description}
            before={
              <Checkbox
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
            }
            onClick={() => {
              if (step.action_path) void navigator.push(step.action_path)
            }}
          >
            {step.title}
          </SimpleCell>
        ))}
      </Group>
      <Group header={<Header>Сообщить об ошибке</Header>}>
        <FormItem
          top="Что нужно исправить?"
          bottom="Не указывайте телефон, email и другие лишние персональные данные."
        >
          <Textarea
            value={message}
            maxLength={2000}
            placeholder="Например: изменился кабинет дирекции"
            onChange={(event) => setMessage(event.target.value)}
          />
        </FormItem>
        <Div>
          <Button
            disabled={message.trim().length < 5}
            loading={issue.isPending}
            onClick={() => issue.mutate()}
          >
            Отправить
          </Button>
        </Div>
        {issue.isSuccess && (
          <Banner
            title="Спасибо"
            subtitle="Сообщение появилось в очереди редакторов."
          />
        )}
      </Group>
    </Panel>
  )
}
