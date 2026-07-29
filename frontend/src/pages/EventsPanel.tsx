import {
  Icon20CalendarOutline,
  Icon20LinkCircleOutline,
  Icon20NotificationOutline,
  Icon20PlaceOutline,
  Icon20UsersOutline,
} from '@vkontakte/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Banner,
  Button,
  ButtonGroup,
  Card,
  CardGrid,
  Div,
  Group,
  Header,
  Panel,
  Placeholder,
  Spinner,
  Text,
  Title,
} from '@vkontakte/vkui'
import { useMemo } from 'react'

import { EventOccurrence, getEvents, subscribeToEvent } from '../api/events'
import { getResources, ResourceLink } from '../api/students'
import { AppPanelHeader } from '../components/AppPanelHeader'
import { openExternalUrl } from '../platformLinks'

const STATUS_LABELS = {
  scheduled: 'Запланировано',
  moved: 'Перенесено',
  cancelled: 'Отменено',
  completed: 'Завершено',
} as const

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value))
}

function meetingStatus(event?: EventOccurrence): string {
  if (!event || !event.is_confirmed) return 'Ожидает подтверждения'
  if (event.status === 'moved') return 'Перенесено'
  if (event.status === 'cancelled') return 'Отменено'
  return 'Подтверждено'
}

function contextualResources(
  resources: ResourceLink[],
  context: 'meeting' | 'events',
): ResourceLink[] {
  return resources.filter((resource) => resource.contexts.includes(context))
}

function EventCard({
  event,
  onSubscribe,
  loading,
}: {
  event: EventOccurrence
  onSubscribe: () => void
  loading: boolean
}) {
  return (
    <Card
      mode="shadow"
      className={event.status === 'cancelled' ? 'event-card--cancelled' : ''}
    >
      <Div className="event-card">
        <Text className={`event-status event-status--${event.status}`}>
          {STATUS_LABELS[event.status]}
          {!event.is_confirmed && ' · ожидает подтверждения'}
        </Text>
        <Title level="3">{event.title}</Title>
        <Text className="event-detail">
          <Icon20CalendarOutline aria-hidden />
          {formatEventDate(event.starts_at)}
        </Text>
        {event.location && (
          <Text className="event-detail">
            <Icon20PlaceOutline aria-hidden />
            {event.location}
          </Text>
        )}
        {event.description && (
          <Text className="event-description">{event.description}</Text>
        )}
        <ButtonGroup mode="horizontal" gap="s" className="event-actions">
          {event.status !== 'cancelled' && event.status !== 'completed' && (
            <Button
              size="s"
              mode="secondary"
              before={<Icon20NotificationOutline />}
              loading={loading}
              onClick={onSubscribe}
            >
              Напомнить
            </Button>
          )}
          {event.external_url && (
            <Button
              size="s"
              mode="tertiary"
              before={<Icon20LinkCircleOutline />}
              onClick={() => void openExternalUrl(event.external_url!)}
            >
              Сообщество
            </Button>
          )}
        </ButtonGroup>
      </Div>
    </Card>
  )
}

function ResourceButtons({ resources }: { resources: ResourceLink[] }) {
  if (resources.length === 0) return null
  return (
    <ButtonGroup mode="vertical" gap="s" stretched>
      {resources.map((resource) => (
        <Button
          key={resource.id}
          mode="secondary"
          before={<Icon20UsersOutline />}
          onClick={() => void openExternalUrl(resource.url)}
        >
          {resource.title}
        </Button>
      ))}
    </ButtonGroup>
  )
}

export function EventsPanel({ id = 'events' }: { id?: string }) {
  const events = useQuery({ queryKey: ['events'], queryFn: () => getEvents() })
  const resources = useQuery({
    queryKey: ['resources'],
    queryFn: getResources,
  })
  const subscription = useMutation({ mutationFn: subscribeToEvent })
  const nextMeeting = useMemo(
    () =>
      events.data?.find(
        (event) =>
          event.event_type === 'union_meeting' &&
          event.status !== 'completed',
      ),
    [events.data],
  )
  const timeline = useMemo(
    () =>
      events.data?.filter(
        (event) =>
          event.event_type !== 'union_meeting' ||
          event.occurrence_id !== nextMeeting?.occurrence_id,
      ) ?? [],
    [events.data, nextMeeting],
  )
  const meetingResources = contextualResources(
    resources.data ?? [],
    'meeting',
  )
  const eventResources = contextualResources(resources.data ?? [], 'events')

  return (
    <Panel id={id}>
      <AppPanelHeader>События</AppPanelHeader>
      <Group>
        <Banner
          title="Календарь первокурсника"
          subtitle="Подтверждённые встречи, дедлайны и мероприятия — по московскому времени."
        />
      </Group>

      <Group header={<Header>Ближайшее собрание</Header>}>
        <Div>
          <section className="meeting-spotlight" aria-label="Ближайшее собрание">
            <Text
              className={`event-status event-status--${
                nextMeeting?.status ?? 'pending'
              }`}
            >
              {meetingStatus(nextMeeting)}
            </Text>
            <Title level="2">
              {nextMeeting?.title ?? 'Дата следующего собрания уточняется'}
            </Title>
            {nextMeeting ? (
              <>
                <Text className="event-detail">
                  <Icon20CalendarOutline aria-hidden />
                  {formatEventDate(nextMeeting.starts_at)}
                </Text>
                {nextMeeting.location && (
                  <Text className="event-detail">
                    <Icon20PlaceOutline aria-hidden />
                    {nextMeeting.location}
                  </Text>
                )}
                {nextMeeting.description && <Text>{nextMeeting.description}</Text>}
              </>
            ) : (
              <Text>
                Не назначаем встречу без подтверждённых даты и места. Следите за
                объявлениями профбюро и профкома.
              </Text>
            )}
            <ButtonGroup mode="horizontal" gap="s" className="event-actions">
              {nextMeeting &&
                nextMeeting.status !== 'cancelled' &&
                nextMeeting.status !== 'completed' && (
                  <Button
                    mode="primary"
                    before={<Icon20NotificationOutline />}
                    loading={
                      subscription.isPending &&
                      subscription.variables?.occurrence_id ===
                        nextMeeting.occurrence_id
                    }
                    onClick={() => subscription.mutate(nextMeeting)}
                  >
                    Напомнить
                  </Button>
                )}
              {nextMeeting?.external_url && (
                <Button
                  mode="secondary"
                  before={<Icon20LinkCircleOutline />}
                  onClick={() =>
                    void openExternalUrl(nextMeeting.external_url!)
                  }
                >
                  Сообщество
                </Button>
              )}
            </ButtonGroup>
            <ResourceButtons resources={meetingResources} />
          </section>
        </Div>
      </Group>

      <Group header={<Header>Календарь мероприятий</Header>}>
        {events.isLoading && <Spinner size="m" />}
        {events.isError && (
          <Banner
            title="Календарь временно недоступен"
            subtitle="Опубликованные даты не удалось загрузить."
            actions={
              <Button onClick={() => void events.refetch()}>Повторить</Button>
            }
          />
        )}
        {events.isSuccess && timeline.length === 0 && (
          <Placeholder
            icon={<Icon20CalendarOutline width={48} height={48} />}
            title="Новых мероприятий пока нет"
          >
            Мы не показываем черновики без подтверждённой даты. Подпишитесь на
            сообщества — там анонсы появляются первыми.
            <Div className="event-empty-actions">
              <ResourceButtons resources={eventResources} />
            </Div>
          </Placeholder>
        )}
        <CardGrid size="l">
          {timeline.map((event) => (
            <EventCard
              key={event.occurrence_id}
              event={event}
              loading={
                subscription.isPending &&
                subscription.variables?.occurrence_id === event.occurrence_id
              }
              onSubscribe={() => subscription.mutate(event)}
            />
          ))}
        </CardGrid>
        {subscription.isSuccess && (
          <Banner
            title="Напоминание сохранено"
            subtitle="Канал доставки можно выбрать в настройках."
          />
        )}
        {subscription.isError && (
          <Banner
            title="Не удалось сохранить напоминание"
            subtitle="Событие осталось в календаре — можно повторить попытку."
            actions={
              subscription.variables ? (
                <Button
                  onClick={() =>
                    subscription.mutate(subscription.variables)
                  }
                >
                  Повторить
                </Button>
              ) : undefined
            }
          />
        )}
      </Group>
    </Panel>
  )
}
