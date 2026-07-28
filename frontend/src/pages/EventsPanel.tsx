import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Banner,
  Button,
  Card,
  CardGrid,
  Div,
  Group,
  Header,
  Panel,
  PanelHeader,
  Placeholder,
  SegmentedControl,
  Text,
  Title,
} from '@vkontakte/vkui'
import { useState } from 'react'

import { EventOccurrence, getEvents, subscribeToEvent } from '../api/events'

const STATUS_LABELS = {
  scheduled: 'Запланировано',
  moved: 'Перенесено',
  cancelled: 'Отменено',
  completed: 'Завершено',
} as const

function EventCard({
  event,
  onSubscribe,
  loading,
}: {
  event: EventOccurrence
  onSubscribe: () => void
  loading: boolean
}) {
  const startsAt = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(event.starts_at))

  return (
    <Card
      mode="shadow"
      className={event.status === 'cancelled' ? 'event-card--cancelled' : ''}
    >
      <Div className="event-card">
        <Text className="eyebrow">
          {STATUS_LABELS[event.status]}
          {!event.is_confirmed && ' · предварительно'}
        </Text>
        <Title level="3">{event.title}</Title>
        <Text>{startsAt}</Text>
        {event.location && <Text className="muted">{event.location}</Text>}
        {event.status !== 'cancelled' && (
          <Button
            size="s"
            mode="secondary"
            loading={loading}
            onClick={onSubscribe}
          >
            Напомнить
          </Button>
        )}
      </Div>
    </Card>
  )
}

export function EventsPanel({ id = 'events' }: { id?: string }) {
  const [filter, setFilter] = useState<'all' | 'union_meeting'>('all')
  const events = useQuery({
    queryKey: ['events', filter],
    queryFn: () => getEvents(filter === 'all' ? undefined : filter),
  })
  const subscription = useMutation({ mutationFn: subscribeToEvent })

  return (
    <Panel id={id}>
      <PanelHeader>События</PanelHeader>
      <Group>
        <Banner
          title="Календарь первокурсника"
          subtitle="Встречи с тьюторами, дедлайны и события — по московскому времени."
        />
      </Group>
      <Group header={<Header>Ближайшее</Header>}>
        <Div>
          <SegmentedControl
            value={filter}
            options={[
              { label: 'Все', value: 'all' },
              { label: 'Собрания', value: 'union_meeting' },
            ]}
            onChange={(value) => setFilter(value)}
          />
        </Div>
        {events.data?.length === 0 && (
          <Placeholder>Опубликованных событий пока нет.</Placeholder>
        )}
        {events.isError && (
          <Banner
            title="Календарь временно недоступен"
            subtitle="Попробуйте обновить раздел позже."
          />
        )}
        <CardGrid size="l">
          {events.data?.map((event) => (
            <EventCard
              key={event.occurrence_id}
              event={event}
              loading={subscription.isPending}
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
      </Group>
    </Panel>
  )
}
