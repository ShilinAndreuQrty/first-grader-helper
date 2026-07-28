import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  PanelHeader,
  Placeholder,
  Search,
  SimpleCell,
  Spinner,
  Text,
  Title,
} from '@vkontakte/vkui'
import { useState } from 'react'

import {
  findScheduleGroups,
  getSchedule,
  saveGroupByCode,
} from '../api/schedule'
import { getMyGroups } from '../api/students'
import { openExternalUrl } from '../platformLinks'

export function SchedulePanel({ id = 'schedule' }: { id?: string }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const saved = useQuery({ queryKey: ['my-groups'], queryFn: getMyGroups })
  const primary = saved.data?.find((group) => group.is_primary)
  const activeCode = selectedCode || primary?.code || ''
  const suggestions = useQuery({
    queryKey: ['schedule-groups', search],
    queryFn: () => findScheduleGroups(search),
    enabled: search.trim().length > 0,
  })
  const schedule = useQuery({
    queryKey: ['schedule', activeCode],
    queryFn: () => getSchedule(activeCode),
    enabled: Boolean(activeCode),
  })
  const save = useMutation({
    mutationFn: saveGroupByCode,
    onSuccess: (group) => {
      setSelectedCode(group.code)
      setSearch('')
      void queryClient.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })

  return (
    <Panel id={id}>
      <PanelHeader>Расписание</PanelHeader>
      <Group header={<Header>Учебная группа</Header>}>
        <Search
          value={search}
          placeholder="Начните вводить номер группы"
          onChange={(event) => setSearch(event.target.value)}
        />
        {suggestions.isFetching && <Spinner size="s" />}
        {suggestions.data?.slice(0, 10).map((code) => (
          <SimpleCell
            key={code}
            after={
              <Button
                size="s"
                loading={save.isPending}
                onClick={() => save.mutate(code)}
              >
                Выбрать
              </Button>
            }
          >
            {code}
          </SimpleCell>
        ))}
        {suggestions.isError && (
          <Banner
            title="Поиск групп недоступен"
            subtitle="ТулГУ временно не отвечает. Сохранённые группы останутся доступны."
          />
        )}
        <Div>
          <ButtonGroup mode="horizontal" gap="s" stretched>
            {saved.data?.map((group) => (
              <Button
                key={group.id}
                mode={activeCode === group.code ? 'primary' : 'secondary'}
                onClick={() => setSelectedCode(group.code)}
              >
                {group.code}
              </Button>
            ))}
          </ButtonGroup>
        </Div>
      </Group>
      {!activeCode && (
        <Group>
          <Banner
            title="Сначала выберите группу"
            subtitle="Начните вводить официальный номер выше. Выбор сохранится в профиле."
          />
        </Group>
      )}
      {schedule.isFetching && <Spinner size="m" />}
      {schedule.data?.is_stale && (
        <Group>
          <Banner
            title="Показана сохранённая копия"
            subtitle="Сервис ТулГУ сейчас недоступен. Время последнего обновления указано ниже."
          />
        </Group>
      )}
      {schedule.isError && (
        <Group>
          <Banner
            title="Расписание временно недоступно"
            subtitle="Для этой группы ещё нет сохранённой копии. Попробуйте позднее."
          />
        </Group>
      )}
      {schedule.data && (
        <Group
          header={
            <Header
              subtitle={`Обновлено ${new Date(
                schedule.data.fetched_at,
              ).toLocaleString('ru-RU')}`}
            >
              {schedule.data.group_code}
            </Header>
          }
        >
          {schedule.data.lessons.length === 0 && (
            <Placeholder>На опубликованный период занятий нет.</Placeholder>
          )}
          <CardGrid size="l">
            {schedule.data.lessons.map((lesson, index) => (
              <Card
                key={`${lesson.date}-${lesson.time}-${lesson.subject}-${index}`}
                mode="outline"
              >
                <Div className="lesson-card">
                  <Text className="eyebrow">
                    {new Date(`${lesson.date}T12:00:00`).toLocaleDateString(
                      'ru-RU',
                      { weekday: 'long', day: 'numeric', month: 'long' },
                    )}
                  </Text>
                  <Title level="3">{lesson.subject}</Title>
                  <Text>
                    {lesson.time}
                    {lesson.lesson_type && ` · ${lesson.lesson_type}`}
                  </Text>
                  <Text className="muted">
                    {[lesson.room, lesson.teacher].filter(Boolean).join(' · ')}
                  </Text>
                </Div>
              </Card>
            ))}
          </CardGrid>
          <Div>
            <Button
              mode="secondary"
              onClick={() =>
                void openExternalUrl(schedule.data.source_url)
              }
            >
              Открыть официальный источник
            </Button>
          </Div>
        </Group>
      )}
    </Panel>
  )
}
