import {
  Icon20CalendarOutline,
  Icon20UserOutline,
  Icon20WriteOutline,
} from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banner,
  Button,
  ButtonGroup,
  Card,
  CardGrid,
  DateInput,
  Div,
  FormItem,
  Group,
  Header,
  Input,
  Panel,
  PanelHeader,
  Search,
  SimpleCell,
  Spinner,
  Text,
  Textarea,
  Title,
} from '@vkontakte/vkui'
import { FormEvent, ReactNode, useMemo, useState } from 'react'

import {
  AdminEvent,
  EventPayload,
  createEvent,
  deleteEvent,
  getAdminDashboard,
  getAdminEvents,
  getAdminFeedback,
  getAdminStudents,
  updateEvent,
} from '../api/admin'
import { ApiError } from '../api/client'
import { openExternalUrl } from '../platformLinks'

type EventKind = 'meeting' | 'event'

interface EventFormState {
  kind: EventKind
  title: string
  description: string
  startsAt: Date | null
  location: string
  registrationUrl: string
}

interface Metric {
  label: string
  value: number
  hint?: string
}

const PUBLIC_APP_URL = 'https://vk.ru/app54697971'

const emptyForm = (): EventFormState => ({
  kind: 'meeting',
  title: '',
  description: '',
  startsAt: null,
  location: '',
  registrationUrl: '',
})

function toPayload(form: EventFormState): EventPayload {
  const startsAt = form.startsAt!
  return {
    title:
      form.kind === 'meeting'
        ? form.title.trim() || 'Собрание первокурсников'
        : form.title.trim(),
    description: form.description.trim(),
    event_type: form.kind === 'meeting' ? 'union_meeting' : 'other',
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 90 * 60_000).toISOString(),
    location: form.location.trim(),
    organizer: 'Тьюторское сообщество ИПМКН',
    external_url:
      form.kind === 'event' ? form.registrationUrl.trim() || null : null,
    status: 'published',
    occurrence_status: 'scheduled',
    is_confirmed: true,
  }
}

function payloadFromEvent(event: AdminEvent, status = event.occurrence_status): EventPayload {
  return {
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    location: event.location,
    organizer: event.organizer,
    external_url: event.external_url,
    status: event.status,
    occurrence_status: status,
    is_confirmed: event.is_confirmed,
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'нет данных'
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value))
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'VK'
}

function Metrics({ items }: { items: Metric[] }) {
  return (
    <CardGrid size="s" className="admin-metrics">
      {items.map((item) => (
        <Card key={item.label} mode="shadow">
          <Div className="admin-metric">
            <Title level="2">{item.value}</Title>
            <Text>{item.label}</Text>
            {item.hint && <Text className="muted">{item.hint}</Text>}
          </Div>
        </Card>
      ))}
    </CardGrid>
  )
}

function AccessState({ error, fallback }: { error: unknown; fallback: ReactNode }) {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    return (
      <Group>
        <Banner
          title="Нет доступа"
          subtitle="Этот раздел доступен только назначенным администраторам."
        />
      </Group>
    )
  }
  return <>{fallback}</>
}

function AdminPanelHeader({ children }: { children: ReactNode }) {
  return (
    <PanelHeader
      after={
        <Button
          Component="a"
          className="admin-open-public-app"
          size="s"
          mode="tertiary"
          href={PUBLIC_APP_URL}
          target="_top"
          aria-label="Открыть публичное приложение"
        >
          Открыть приложение
        </Button>
      }
    >
      {children}
    </PanelHeader>
  )
}

export function AdminEventsPanel({ id = 'events' }: { id?: string }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EventFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [savedNotice, setSavedNotice] = useState('')
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    retry: false,
  })
  const events = useQuery({
    queryKey: ['admin-events'],
    queryFn: getAdminEvents,
    retry: false,
    enabled: dashboard.isSuccess,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
    void queryClient.invalidateQueries({ queryKey: ['events'] })
  }
  const save = useMutation({
    mutationFn: (payload: EventPayload) =>
      editingId ? updateEvent({ id: editingId, payload }) : createEvent(payload),
    onSuccess: () => {
      setSavedNotice(
        editingId
          ? 'Изменения сохранены.'
          : 'Событие опубликовано и уже доступно пользователям.',
      )
      setForm(emptyForm())
      setEditingId(null)
      refresh()
    },
  })
  const changeStatus = useMutation({
    mutationFn: ({ event, status }: { event: AdminEvent; status: 'scheduled' | 'cancelled' }) =>
      updateEvent({ id: event.id, payload: payloadFromEvent(event, status) }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: refresh,
  })

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    if (!form.startsAt || !form.location.trim()) {
      setFormError('Укажите дату, время и место.')
      return
    }
    if (form.kind === 'event' && form.title.trim().length < 3) {
      setFormError('Добавьте название мероприятия.')
      return
    }
    setFormError('')
    setSavedNotice('')
    save.mutate(toPayload(form))
  }

  const edit = (event: AdminEvent) => {
    setEditingId(event.id)
    setForm({
      kind: event.event_type === 'union_meeting' ? 'meeting' : 'event',
      title: event.event_type === 'union_meeting' ? '' : event.title,
      description: event.description,
      startsAt: new Date(event.starts_at),
      location: event.location,
      registrationUrl: event.external_url ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Panel id={id}>
      <AdminPanelHeader>События</AdminPanelHeader>
      {dashboard.isLoading && <Spinner size="m" />}
      {dashboard.isError && (
        <AccessState
          error={dashboard.error}
          fallback={<Group><Banner title="Раздел временно недоступен" subtitle="Попробуйте обновить страницу." /></Group>}
        />
      )}
      {dashboard.data && (
        <>
          <Group header={<Header>Статистика событий</Header>}>
            <Metrics
              items={[
                { value: dashboard.data.upcoming_events, label: 'событий в ближайшие 30 дней' },
                { value: dashboard.data.active_registrations, label: 'отметок «Я приду»' },
                { value: dashboard.data.event_participants, label: 'уникальных участников' },
                { value: dashboard.data.cancelled_events, label: 'отменено за 30 дней' },
              ]}
            />
          </Group>

          <Group
            className="admin-event-editor"
            header={<Header>{editingId ? 'Редактирование события' : 'Создать событие'}</Header>}
          >
            <Div>
              <ButtonGroup mode="horizontal" gap="s" stretched>
                <Button
                  mode={form.kind === 'meeting' ? 'primary' : 'secondary'}
                  onClick={() => setForm((value) => ({ ...value, kind: 'meeting' }))}
                >
                  Ближайшее собрание
                </Button>
                <Button
                  mode={form.kind === 'event' ? 'primary' : 'secondary'}
                  onClick={() => setForm((value) => ({ ...value, kind: 'event' }))}
                >
                  Другое событие
                </Button>
              </ButtonGroup>
            </Div>
            <form onSubmit={submit}>
              {form.kind === 'event' && (
                <FormItem top="Название">
                  <Input
                    value={form.title}
                    placeholder="Посвят или встреча клуба"
                    onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                  />
                </FormItem>
              )}
              <FormItem top="Дата и время начала">
                <DateInput
                  value={form.startsAt}
                  onChange={(startsAt) => setForm((value) => ({ ...value, startsAt }))}
                  enableTime
                  disablePast
                  doneButtonText="Готово"
                  calendarLabel="Выберите дату и время"
                />
              </FormItem>
              <FormItem top="Место">
                <Input
                  value={form.location}
                  placeholder="Главный корпус, 403"
                  onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))}
                />
              </FormItem>
              {form.kind === 'event' && (
                <FormItem top="Ссылка на регистрацию" bottom="После «Я приду» участник перейдёт по этой ссылке.">
                  <Input
                    value={form.registrationUrl}
                    inputMode="url"
                    placeholder="https://vk.ru/..."
                    onChange={(event) => setForm((value) => ({ ...value, registrationUrl: event.target.value }))}
                  />
                </FormItem>
              )}
              <FormItem top="Описание — необязательно">
                <Textarea
                  value={form.description}
                  placeholder="Что важно знать участникам"
                  onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                />
              </FormItem>
              {formError && <Div><Text className="admin-form-error">{formError}</Text></Div>}
              <Div className="admin-form-actions">
                <Button type="submit" size="l" stretched loading={save.isPending} disabled={save.isPending}>
                  {editingId ? 'Сохранить изменения' : 'Опубликовать'}
                </Button>
                {editingId && (
                  <Button mode="tertiary" stretched onClick={() => { setEditingId(null); setForm(emptyForm()) }}>
                    Отменить редактирование
                  </Button>
                )}
              </Div>
              {save.isError && <Banner title="Не удалось сохранить" subtitle="Проверьте поля и попробуйте ещё раз." />}
              {savedNotice && <Banner title="Готово" subtitle={savedNotice} />}
            </form>
          </Group>

          <Group header={<Header>Опубликованные события</Header>}>
            {events.isLoading && <Spinner size="m" />}
            {events.isError && <Banner title="Не удалось загрузить список" subtitle="Обновите страницу. События не потеряны." />}
            {events.data?.length === 0 && <Div><Text className="muted">Событий пока нет.</Text></Div>}
            {events.data?.map((event) => (
              <SimpleCell
                key={event.id}
                before={<Icon20CalendarOutline />}
                subtitle={`${formatDate(event.starts_at)} · ${event.location || 'место не указано'}`}
                after={<span className="admin-registration-count"><Icon20UserOutline />{event.registration_count}</span>}
              >
                <div className={event.occurrence_status === 'cancelled' ? 'admin-event-cancelled' : undefined}>{event.title}</div>
                <ButtonGroup mode="horizontal" gap="s" className="admin-event-actions">
                  <Button size="s" mode="tertiary" before={<Icon20WriteOutline />} onClick={(clickEvent) => { clickEvent.stopPropagation(); edit(event) }}>
                    Изменить
                  </Button>
                  <Button
                    size="s"
                    mode="tertiary"
                    loading={changeStatus.isPending && changeStatus.variables?.event.id === event.id}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation()
                      changeStatus.mutate({ event, status: event.occurrence_status === 'cancelled' ? 'scheduled' : 'cancelled' })
                    }}
                  >
                    {event.occurrence_status === 'cancelled' ? 'Вернуть' : 'Отменить'}
                  </Button>
                  {event.occurrence_status === 'cancelled' && (
                    <Button
                      size="s"
                      mode="tertiary"
                      appearance="negative"
                      loading={remove.isPending && remove.variables === event.id}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        if (window.confirm(`Удалить «${event.title}»?`)) remove.mutate(event.id)
                      }}
                    >
                      Удалить
                    </Button>
                  )}
                </ButtonGroup>
              </SimpleCell>
            ))}
          </Group>
        </>
      )}
    </Panel>
  )
}

export function AdminUsersPanel({ id = 'users' }: { id?: string }) {
  const [search, setSearch] = useState('')
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    retry: false,
  })
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminStudents,
    retry: false,
  })
  const filteredUsers = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('ru-RU')
    if (!value) return users.data ?? []
    return (users.data ?? []).filter((user) =>
      [user.display_name, String(user.vk_user_id), user.primary_group ?? '']
        .some((field) => field.toLocaleLowerCase('ru-RU').includes(value)),
    )
  }, [search, users.data])

  const error = users.error ?? dashboard.error

  return (
    <Panel id={id}>
      <AdminPanelHeader>Пользователи</AdminPanelHeader>
      {(users.isLoading || dashboard.isLoading) && <Spinner size="m" />}
      {(users.isError || dashboard.isError) && (
        <AccessState
          error={error}
          fallback={<Group><Banner title="Раздел временно недоступен" subtitle="Попробуйте обновить страницу." /></Group>}
        />
      )}
      {users.data && dashboard.data && (
        <>
          <Group header={<Header>Аудитория приложения</Header>}>
            <Metrics
              items={[
                { value: dashboard.data.total_users, label: 'зарегистрированных пользователей', hint: 'входили в публичное приложение' },
                { value: dashboard.data.new_users_7d, label: 'новых за 7 дней' },
                { value: dashboard.data.active_users_7d, label: 'активных за 7 дней' },
              ]}
            />
            <Div>
              <Text className="muted">
                Регистрация происходит автоматически при первом успешном входе через VK. Последняя активность обновляется при использовании приложения.
              </Text>
            </Div>
          </Group>

          <Group header={<Header>Все пользователи · {users.data.length}</Header>}>
            <Search
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Имя, VK ID или группа"
              after={null}
            />
            {filteredUsers.length === 0 && (
              <Div><Text className="muted">По вашему запросу никого не найдено.</Text></Div>
            )}
            {filteredUsers.map((user) => (
              <SimpleCell
                key={user.id}
                className="admin-user-row"
                before={<span className="admin-user-avatar">{initials(user.display_name)}</span>}
                indicator={user.primary_group ?? 'Без группы'}
                subtitle={
                  <span className="admin-user-meta">
                    <span>VK ID {user.vk_user_id}</span>
                    <span>Первый вход: {formatDate(user.first_login_at)}</span>
                    <span>Последняя активность: {formatDate(user.last_activity_at)}</span>
                    <span>Группа: {user.primary_group ?? 'не указана'}</span>
                    <span>Запусков: {user.launch_count}</span>
                  </span>
                }
                onClick={() => void openExternalUrl(user.profile_url)}
              >
                {user.display_name}
              </SimpleCell>
            ))}
          </Group>

        </>
      )}
    </Panel>
  )
}

const feedbackStatus: Record<string, string> = {
  new: 'Новое',
  in_progress: 'В работе',
  resolved: 'Решено',
  closed: 'Закрыто',
}

export function AdminFeedbackPanel({ id = 'feedback' }: { id?: string }) {
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    retry: false,
  })
  const feedback = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: getAdminFeedback,
    retry: false,
  })
  const error = feedback.error ?? dashboard.error

  return (
    <Panel id={id}>
      <AdminPanelHeader>Обратная связь</AdminPanelHeader>
      {(feedback.isLoading || dashboard.isLoading) && <Spinner size="m" />}
      {(feedback.isError || dashboard.isError) && (
        <AccessState
          error={error}
          fallback={<Group><Banner title="Раздел временно недоступен" subtitle="Попробуйте обновить страницу." /></Group>}
        />
      )}
      {feedback.data && dashboard.data && (
        <>
          <Group header={<Header>Обращения</Header>}>
            <Metrics
              items={[
                { value: dashboard.data.new_feedback, label: 'новых сообщений' },
                { value: dashboard.data.feedback_total, label: 'сообщений всего' },
              ]}
            />
          </Group>
          <Group header={<Header>Сообщения пользователей</Header>}>
            {feedback.data.length === 0 && (
              <Banner title="Новых сообщений пока нет" subtitle="Обращения из публичного приложения появятся здесь." />
            )}
            {feedback.data.map((item) => (
              <SimpleCell
                key={item.id}
                className="admin-feedback-row"
                subtitle={`${item.user_name} · ${formatDate(item.created_at)}`}
                indicator={feedbackStatus[item.status] ?? item.status}
                onClick={item.profile_url ? () => void openExternalUrl(item.profile_url!) : undefined}
              >
                {item.message}
              </SimpleCell>
            ))}
          </Group>
        </>
      )}
    </Panel>
  )
}

// Kept as the default admin landing panel for direct component consumers and tests.
export function AdminPanel({ id = 'events' }: { id?: string }) {
  return <AdminEventsPanel id={id} />
}
