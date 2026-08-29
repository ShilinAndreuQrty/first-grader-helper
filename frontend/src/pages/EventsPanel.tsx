import {
  Icon20CalendarOutline,
  Icon20CheckCircleOutline,
  Icon20PlaceOutline,
} from '@vkontakte/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Banner, Button, Card, Div, Panel, Spinner, Text, Title } from '@vkontakte/vkui'
import { CSSProperties, useMemo, useState } from 'react'

import { EventOccurrence, getEvents, getSubscribedEventIds, subscribeToEvent } from '../api/events'
import { getInAppReminders } from '../api/notifications'
import { AppPanelHeader } from '../components/AppPanelHeader'
import { openExternalUrl } from '../platformLinks'

const STATUS_LABELS = {
  scheduled: 'Скоро',
  moved: 'Перенесено',
  cancelled: 'Отменено',
  completed: 'Завершено',
} as const

function eventDay(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value))
}

function eventTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value))
}

function eventStatusLabel(event: EventOccurrence): string | null {
  if (event.status !== 'scheduled') return STATUS_LABELS[event.status]
  const untilStart = new Date(event.starts_at).getTime() - Date.now()
  return untilStart >= 0 && untilStart <= 7 * 24 * 60 * 60_000
    ? STATUS_LABELS.scheduled
    : null
}

function AttendButton({
  event,
  subscribed,
  loading,
  onAttend,
}: {
  event: EventOccurrence
  subscribed: boolean
  loading: boolean
  onAttend: () => void
}) {
  if (event.event_type === 'union_meeting') return null
  if (event.status === 'cancelled' || event.status === 'completed') return null
  return (
    <Button
      size="m"
      mode={subscribed ? 'secondary' : 'primary'}
      before={subscribed ? <Icon20CheckCircleOutline /> : undefined}
      loading={loading}
      onClick={subscribed && event.external_url ? () => void openExternalUrl(event.external_url!) : onAttend}
    >
      {subscribed ? (event.external_url ? 'Открыть регистрацию' : 'Вы идёте') : 'Я приду'}
    </Button>
  )
}

function EventCard({
  event,
  subscribed,
  loading,
  onAttend,
  hierarchyIndex,
}: {
  event: EventOccurrence
  subscribed: boolean
  loading: boolean
  onAttend: () => void
  hierarchyIndex: number
}) {
  const rank = Math.min(hierarchyIndex, 6)
  const hierarchyStyle = {
    '--event-width-cut': `${rank * 16}px`,
    '--event-opacity': `${Math.max(0.52, 1 - rank * 0.1)}`,
    '--event-darken': `${rank * 5}%`,
    '--event-tint': `${Math.max(2, 10 - rank)}%`,
  } as CSSProperties
  return (
    <Card
      mode="shadow"
      className={`events-card events-card--${event.status}`}
      style={hierarchyStyle}
    >
      <Div>
        {eventStatusLabel(event) && (
          <Text className={`events-card__label events-card__label--${event.status}`}>
            {eventStatusLabel(event)}
          </Text>
        )}
        <div className="events-card__body">
          <div className="events-card__copy">
            <Title level="2" className="events-card__title">{event.title}</Title>
            {event.description && <Text className="events-description">{event.description}</Text>}
          </div>
          <div className="events-card__schedule">
            <Text>{eventDay(event.starts_at)}</Text>
            <strong>{eventTime(event.starts_at)}</strong>
            {event.location && <Text className="events-card__place"><Icon20PlaceOutline aria-hidden />{event.location}</Text>}
          </div>
        </div>
        <div className="events-actions">
          <AttendButton event={event} subscribed={subscribed} loading={loading} onAttend={onAttend} />
          {subscribed && event.external_url && (
            <Text className="events-registration-hint">Отметка сохранена — осталось заполнить регистрацию</Text>
          )}
        </div>
      </Div>
    </Card>
  )
}

export function EventsPanel({ id = 'events' }: { id?: string }) {
  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => getEvents(),
    refetchInterval: 60_000,
  })
  const savedSubscriptions = useQuery({
    queryKey: ['event-subscriptions'],
    queryFn: getSubscribedEventIds,
  })
  const reminders = useQuery({
    queryKey: ['in-app-reminders'],
    queryFn: getInAppReminders,
    refetchInterval: 15_000,
  })
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set())
  const subscription = useMutation({
    mutationFn: subscribeToEvent,
    onSuccess: (_result, event) => {
      setSubscribed((current) => new Set(current).add(event.occurrence_id))
      if (event.external_url) void openExternalUrl(event.external_url)
    },
  })
  const meetings = useMemo(
    () => events.data?.filter((event) => event.event_type === 'union_meeting' && event.status !== 'completed') ?? [],
    [events.data],
  )
  const nextMeeting = meetings[0]
  const timeline = useMemo(
    () => events.data?.filter((event) => event.event_type !== 'union_meeting') ?? [],
    [events.data],
  )

  const isSubscribed = (event: EventOccurrence) =>
    subscribed.has(event.occurrence_id) ||
    (event.event_id ? savedSubscriptions.data?.includes(event.event_id) === true : false)
  const attend = (event: EventOccurrence) => subscription.mutate(event)
  const loading = (event: EventOccurrence) =>
    subscription.isPending && subscription.variables?.occurrence_id === event.occurrence_id

  return (
    <Panel id={id}>
      <AppPanelHeader>
        События
      </AppPanelHeader>
      <main className="events-page">
        <section className="events-heading">
          <Text className="events-eyebrow">ИПМКН · рядом с тобой</Text>
          <Title level="1">Не пропусти важное</Title>
          <Text>Собрания, встречи и студенческие события в одном месте.</Text>
        </section>

        {reminders.data?.[0] && (
          <Banner
            title={reminders.data[0].title}
            subtitle={reminders.data[0].body}
          />
        )}

        {events.isLoading && <Spinner size="m" />}
        {events.isError && (
          <Banner title="События временно недоступны" subtitle="Не удалось загрузить актуальные даты." actions={<Button onClick={() => void events.refetch()}>Повторить</Button>} />
        )}

        {nextMeeting && (
          <section className={`meeting-hero meeting-hero--${nextMeeting.status}`}>
            <div className="meeting-hero__label">Ближайшее собрание</div>
            <div className="meeting-hero__date">
              <span>{eventDay(nextMeeting.starts_at)}</span>
              <strong>{eventTime(nextMeeting.starts_at)}</strong>
            </div>
            <Title level="2">{nextMeeting.title}</Title>
            {nextMeeting.location && <Text className="meeting-hero__place"><Icon20PlaceOutline />{nextMeeting.location}</Text>}
            {nextMeeting.description && <Text className="meeting-hero__description">{nextMeeting.description}</Text>}
          </section>
        )}

        {events.isSuccess && !nextMeeting && (
          <section className="meeting-empty">
            <Text className="events-section-label">Собрания</Text>
            <Title level="2">Следующая дата уточняется</Title>
            <Text>Когда собрание назначат, здесь появятся время и место.</Text>
          </section>
        )}

        {meetings.length > 1 && (
          <section className="meetings-list">
            <Text className="events-section-label">Другие собрания</Text>
            {meetings.slice(1).map((meeting) => (
              <Card key={meeting.occurrence_id} mode="shadow" className={`meeting-compact meeting-compact--${meeting.status}`}>
                <Div>
                  <div>
                    <Text className="events-date">{eventDay(meeting.starts_at)} · {eventTime(meeting.starts_at)}</Text>
                    <Title level="3">{meeting.title}</Title>
                  </div>
                  {meeting.location && <Text className="meeting-compact__place"><Icon20PlaceOutline />{meeting.location}</Text>}
                </Div>
              </Card>
            ))}
          </section>
        )}

        {events.isSuccess && (
          <section className="events-list">
            <div className="events-list__header">
              <div>
                <Text className="events-section-label">Мероприятия</Text>
                <Title level="2">Дальше по календарю</Title>
              </div>
            </div>
            {timeline.length === 0 ? (
              <div className="events-empty">
                <Icon20CalendarOutline width={32} height={32} />
                <Text>Новых мероприятий пока нет.</Text>
              </div>
            ) : (
              timeline.map((event, index) => (
                <EventCard
                  key={event.occurrence_id}
                  event={event}
                  subscribed={isSubscribed(event)}
                  loading={loading(event)}
                  onAttend={() => attend(event)}
                  hierarchyIndex={index}
                />
              ))
            )}
          </section>
        )}
        {subscription.isError && <Banner title="Не удалось сохранить отметку" subtitle="Попробуйте нажать «Я приду» ещё раз." />}
      </main>
    </Panel>
  )
}
