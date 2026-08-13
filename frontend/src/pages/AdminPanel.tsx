import { Icon20CalendarOutline, Icon20UserOutline, Icon20WriteOutline } from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
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
  PanelHeaderBack,
  SimpleCell,
  Spinner,
  Text,
  Textarea,
  Title,
} from '@vkontakte/vkui'
import { FormEvent, useState } from 'react'

import {
  AdminEvent,
  EventPayload,
  createEvent,
  deleteEvent,
  getAdminDashboard,
  getAdminEvents,
  getAdminFeedback,
  getAdminStudents,
  resetMyDemoData,
  updateEvent,
} from '../api/admin'
import { ApiError } from '../api/client'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'
import { takeAdminReturnPath } from '../navigation'

const metricLabels: Record<string, string> = {
  upcoming_events: 'событий в ближайшие 30 дней',
  active_registrations: 'активных регистраций',
  registered_users: 'участников отметили «Я приду»',
  cancelled_events: 'отменено за последний месяц',
  recent_audit: 'изменений за 7 дней',
}

type EventKind = 'meeting' | 'event'

interface EventFormState {
  kind: EventKind
  title: string
  description: string
  startsAt: Date | null
  location: string
  registrationUrl: string
}

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

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value))
}

export function AdminPanel({ id = 'admin' }: { id?: string }) {
  const navigator = useRouteNavigator()
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
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminStudents,
    retry: false,
    enabled: dashboard.isSuccess,
  })
  const feedback = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: getAdminFeedback,
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
      setSavedNotice(editingId ? 'Изменения сохранены.' : 'Событие опубликовано и уже доступно во вкладке «События».')
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
  const resetDemo = useMutation({
    mutationFn: resetMyDemoData,
    onSuccess: () => {
      sessionStorage.removeItem('ipmkn.assistant-history-v1')
      sessionStorage.removeItem('ipmkn.assistant-session')
      sessionStorage.removeItem('ipmkn.mapTargetRoom')
      sessionStorage.removeItem('ipmkn.moreTarget')
      queryClient.clear()
      void navigator.push(PANEL_PATHS.home)
    },
  })
  const denied =
    dashboard.error instanceof ApiError && [401, 403].includes(dashboard.error.status)

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
      <PanelHeader
        before={<PanelHeaderBack aria-label="Назад" onClick={() => void navigator.push(takeAdminReturnPath())} />}
      >
        Управление
      </PanelHeader>
      {dashboard.isLoading && <Spinner size="m" />}
      {denied && (
        <Group><Banner title="Нет доступа" subtitle="Админ-панель доступна только назначенным редакторам." /></Group>
      )}
      {dashboard.isError && !denied && (
        <Group><Banner title="Панель временно недоступна" subtitle="Попробуйте обновить страницу." /></Group>
      )}
      {dashboard.data && (
        <>
          <Group className="admin-event-editor" header={<Header>{editingId ? 'Редактирование' : 'Новое событие'}</Header>}>
            <Div>
              <ButtonGroup mode="horizontal" gap="s" stretched>
                <Button mode={form.kind === 'meeting' ? 'primary' : 'secondary'} onClick={() => setForm((value) => ({ ...value, kind: 'meeting' }))}>Ближайшее собрание</Button>
                <Button mode={form.kind === 'event' ? 'primary' : 'secondary'} onClick={() => setForm((value) => ({ ...value, kind: 'event' }))}>Другое событие</Button>
              </ButtonGroup>
            </Div>
            <form onSubmit={submit}>
              {form.kind === 'event' && (
                <FormItem top="Название">
                  <Input value={form.title} placeholder="Посвят или встреча клуба" onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} />
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
                <Input value={form.location} placeholder="Главный корпус, 403" onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))} />
              </FormItem>
              {form.kind === 'event' && (
                <FormItem top="Ссылка на регистрацию" bottom="После «Я приду» участник перейдёт по этой ссылке.">
                  <Input value={form.registrationUrl} inputMode="url" placeholder="https://vk.ru/..." onChange={(event) => setForm((value) => ({ ...value, registrationUrl: event.target.value }))} />
                </FormItem>
              )}
              <FormItem top="Описание — необязательно">
                <Textarea value={form.description} placeholder="Что важно знать участникам" onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
              </FormItem>
              {formError && <Div><Text className="admin-form-error">{formError}</Text></Div>}
              <Div>
                <Button type="submit" size="l" stretched loading={save.isPending} disabled={save.isPending}>
                  {editingId ? 'Сохранить изменения' : 'Опубликовать'}
                </Button>
                {editingId && <Button mode="tertiary" stretched onClick={() => { setEditingId(null); setForm(emptyForm()) }}>Отменить редактирование</Button>}
              </Div>
              {save.isError && <Banner title="Не удалось сохранить" subtitle="Проверьте поля и попробуйте ещё раз." />}
              {savedNotice && <Banner title="Готово" subtitle={savedNotice} />}
            </form>
          </Group>

          <Group header={<Header>События и регистрации</Header>}>
            {events.isLoading && <Spinner size="m" />}
            {events.isError && <Banner title="Не удалось загрузить список" subtitle="Обновите страницу. Опубликованные события при этом не потеряны." />}
            {events.data?.map((event) => (
              <SimpleCell
                key={event.id}
                before={<Icon20CalendarOutline />}
                subtitle={`${formatEventDate(event.starts_at)} · ${event.location || 'место не указано'}`}
                after={<span className="admin-registration-count"><Icon20UserOutline />{event.registration_count}</span>}
              >
                <div className={event.occurrence_status === 'cancelled' ? 'admin-event-cancelled' : undefined}>{event.title}</div>
                <ButtonGroup mode="horizontal" gap="s" className="admin-event-actions">
                  <Button size="s" mode="tertiary" before={<Icon20WriteOutline />} onClick={(clickEvent) => { clickEvent.stopPropagation(); edit(event) }}>Изменить</Button>
                  <Button
                    size="s"
                    mode="tertiary"
                    loading={changeStatus.isPending && changeStatus.variables?.event.id === event.id}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation()
                      changeStatus.mutate({ event, status: event.occurrence_status === 'cancelled' ? 'scheduled' : 'cancelled' })
                    }}
                  >
                    {event.occurrence_status === 'cancelled' ? 'Вернуть' : 'Отменить событие'}
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

          <Group header={<Header>Сводка</Header>}>
            <CardGrid size="s">
              {Object.entries(dashboard.data).map(([key, value]) => (
                <Card key={key} mode="shadow"><Div className="admin-metric"><Title level="2">{value}</Title><Text>{metricLabels[key]}</Text></Div></Card>
              ))}
            </CardGrid>
          </Group>

          {feedback.data && (
            <Group header={<Header>Обратная связь по проекту</Header>}>
              {feedback.data.length === 0 && (
                <Div><Text className="muted">Новых сообщений пока нет.</Text></Div>
              )}
              {feedback.data.map((item) => (
                <SimpleCell
                  key={item.id}
                  subtitle={`${item.user_name} · ${new Date(item.created_at).toLocaleString('ru-RU')}`}
                  indicator={item.status === 'new' ? 'Новое' : item.status}
                  onClick={item.profile_url ? () => void openExternalUrl(item.profile_url!) : undefined}
                >
                  {item.message}
                </SimpleCell>
              ))}
            </Group>
          )}

          {users.data && (
            <Group header={<Header>Пользователи</Header>}>
              {users.data.map((user) => (
                <SimpleCell key={user.id} indicator={user.primary_group ?? 'Без группы'} subtitle={`Активность: ${user.last_activity_at ? new Date(user.last_activity_at).toLocaleString('ru-RU') : 'нет данных'}`} onClick={() => void openExternalUrl(user.profile_url)}>
                  {user.display_name}
                </SimpleCell>
              ))}
            </Group>
          )}

          <Group header={<Header>Демо-режим</Header>}>
            <Banner
              title="Начать презентацию с чистого листа"
              subtitle="Сбросит только ваши группы, маршрут первокурсника, регистрации и настройки. Админ-доступ и созданные события останутся."
              actions={
                <Button
                  appearance="negative"
                  loading={resetDemo.isPending}
                  onClick={() => {
                    if (window.confirm('Сбросить ваши пользовательские данные для демонстрации?')) {
                      resetDemo.mutate()
                    }
                  }}
                >
                  Сбросить мои данные
                </Button>
              }
            />
            {resetDemo.isError && (
              <Banner title="Не удалось выполнить сброс" subtitle="Попробуйте ещё раз." />
            )}
          </Group>
        </>
      )}
    </Panel>
  )
}
