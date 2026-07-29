import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  Card,
  CardGrid,
  Div,
  FormItem,
  Group,
  Header,
  Input,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  SimpleCell,
  Spinner,
  Text,
  Title,
} from '@vkontakte/vkui'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  EventDraft,
  createEvent,
  getAdminDashboard,
  getAdminFaq,
  getAdminStudents,
} from '../api/admin'
import { ApiError } from '../api/client'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'

const eventSchema = z
  .object({
    title: z.string().min(3, 'Введите название'),
    starts_at: z.string().min(1, 'Укажите начало'),
    ends_at: z.string().min(1, 'Укажите окончание'),
    location: z.string().max(300),
  })
  .refine((value) => new Date(value.ends_at) > new Date(value.starts_at), {
    message: 'Окончание должно быть позже начала',
    path: ['ends_at'],
  })

const metricLabels: Record<string, string> = {
  needs_review_faq: 'FAQ ждут проверки',
  upcoming_events: 'События на 30 дней',
  failed_assistant_queries: 'Проблемные запросы',
  unconfirmed_series: 'Серии без подтверждения',
  recent_audit: 'Изменения за 7 дней',
  open_issue_reports: 'Новые сообщения',
}

export function AdminPanel({ id = 'admin' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const queryClient = useQueryClient()
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    retry: false,
  })
  const faq = useQuery({
    queryKey: ['admin-faq'],
    queryFn: getAdminFaq,
    retry: false,
    enabled: dashboard.isSuccess,
  })
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminStudents,
    retry: false,
    enabled: dashboard.isSuccess,
  })
  const form = useForm<EventDraft>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: '', starts_at: '', ends_at: '', location: '' },
  })
  const event = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      form.reset()
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
  const denied =
    dashboard.error instanceof ApiError &&
    [401, 403].includes(dashboard.error.status)

  return (
    <Panel id={id}>
      <PanelHeader
        before={
          <PanelHeaderBack
            aria-label="Назад"
            onClick={() => void navigator.push(PANEL_PATHS.more)}
          />
        }
      >
        Управление
      </PanelHeader>
      {dashboard.isLoading && <Spinner size="m" />}
      {denied && (
        <Group>
          <Banner
            title="Нет доступа"
            subtitle="Админ-панель доступна только назначенным редакторам."
          />
        </Group>
      )}
      {dashboard.isError && !denied && (
        <Group>
          <Banner
            title="Панель временно недоступна"
            subtitle="Попробуйте обновить страницу."
          />
        </Group>
      )}
      {dashboard.data && (
        <>
          <Group header={<Header>Состояние контента</Header>}>
            <CardGrid size="s">
              {Object.entries(dashboard.data).map(([key, value]) => (
                <Card key={key} mode="shadow">
                  <Div className="admin-metric">
                    <Title level="2">{value}</Title>
                    <Text>{metricLabels[key]}</Text>
                  </Div>
                </Card>
              ))}
            </CardGrid>
          </Group>

          <Group header={<Header>Создать событие</Header>}>
            <form
              onSubmit={(submitEvent) =>
                void form.handleSubmit((value) => event.mutate(value))(
                  submitEvent,
                )
              }
            >
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FormItem
                    top="Название"
                    status={fieldState.error ? 'error' : 'default'}
                    bottom={fieldState.error?.message}
                  >
                    <Input {...field} placeholder="Встреча с тьюторами" />
                  </FormItem>
                )}
              />
              <Controller
                name="starts_at"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FormItem
                    top="Начало"
                    status={fieldState.error ? 'error' : 'default'}
                    bottom={fieldState.error?.message}
                  >
                    <Input {...field} type="datetime-local" />
                  </FormItem>
                )}
              />
              <Controller
                name="ends_at"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FormItem
                    top="Окончание"
                    status={fieldState.error ? 'error' : 'default'}
                    bottom={fieldState.error?.message}
                  >
                    <Input {...field} type="datetime-local" />
                  </FormItem>
                )}
              />
              <Controller
                name="location"
                control={form.control}
                render={({ field }) => (
                  <FormItem top="Место">
                    <Input {...field} placeholder="Главный корпус, 403" />
                  </FormItem>
                )}
              />
              <Div>
                <Button
                  type="submit"
                  size="l"
                  loading={event.isPending}
                  disabled={event.isPending}
                >
                  Сохранить черновик
                </Button>
              </Div>
              {event.isSuccess && (
                <Banner
                  title="Черновик сохранён"
                  subtitle="Опубликовать событие можно после проверки."
                />
              )}
            </form>
          </Group>

          <Group header={<Header>База знаний</Header>}>
            {faq.data?.slice(0, 20).map((entry) => (
              <SimpleCell
                key={entry.id}
                indicator={entry.status}
                subtitle={`Версия ${entry.version}`}
              >
                {entry.question}
              </SimpleCell>
            ))}
          </Group>

          {users.data && (
            <Group header={<Header>Пользователи</Header>}>
              {users.data.map((user) => (
                <SimpleCell
                  key={user.id}
                  indicator={user.primary_group ?? 'Без группы'}
                  subtitle={`Первый вход: ${new Date(
                    user.first_login_at,
                  ).toLocaleString('ru-RU')} · Активность: ${
                    user.last_activity_at
                      ? new Date(user.last_activity_at).toLocaleString('ru-RU')
                      : 'нет данных'
                  }`}
                  onClick={() => void openExternalUrl(user.profile_url)}
                >
                  {user.display_name}
                </SimpleCell>
              ))}
            </Group>
          )}
        </>
      )}
    </Panel>
  )
}
