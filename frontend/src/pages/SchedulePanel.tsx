import { Icon20PlaceOutline } from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
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
import { useMemo, useState } from 'react'

import { ApiError } from '../api/client'
import {
  findScheduleGroups,
  getSchedule,
  saveGroupByCode,
} from '../api/schedule'
import { getMyGroups } from '../api/students'
import { setMapTargetRoom } from '../campusLocation'
import {
  GROUP_CODE_HINT,
  isValidGroupCode,
  normalizeGroupCode,
} from '../groupCode'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'

export function SchedulePanel({ id = 'schedule' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const normalizedSearch = useMemo(() => normalizeGroupCode(search), [search])
  const hasValidSearch = isValidGroupCode(normalizedSearch)
  const saved = useQuery({ queryKey: ['my-groups'], queryFn: getMyGroups })
  const primary = saved.data?.find((group) => group.is_primary)
  const activeCode = selectedCode || primary?.code || ''
  const suggestions = useQuery({
    queryKey: ['schedule-groups', normalizedSearch],
    queryFn: () => findScheduleGroups(normalizedSearch),
    enabled: hasValidSearch,
    retry: false,
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
          placeholder="Например, 220031-22"
          onChange={(event) => setSearch(event.target.value)}
        />
        {search.length > 0 && !hasValidSearch && (
          <Banner
            title="Проверьте формат номера"
            subtitle={GROUP_CODE_HINT}
          />
        )}
        {suggestions.isFetching && <Spinner size="s" />}
        {suggestions.data?.is_stale && (
          <Banner
            title="Показан сохранённый результат"
            subtitle={`ТулГУ сейчас недоступен. Данные обновлены ${new Date(
              suggestions.data.fetched_at,
            ).toLocaleString('ru-RU')}.`}
            actions={
              <Button onClick={() => void suggestions.refetch()}>
                Повторить
              </Button>
            }
          />
        )}
        {suggestions.data?.groups.slice(0, 10).map((code) => (
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
        {hasValidSearch &&
          suggestions.isSuccess &&
          !suggestions.data.is_stale &&
          suggestions.data.groups.length === 0 && (
            <Banner
              title="Группа не найдена"
              subtitle="ТулГУ ответил успешно, но такого номера в актуальном словаре нет."
              actions={
                <Button mode="secondary" onClick={() => void suggestions.refetch()}>
                  Повторить
                </Button>
              }
            />
          )}
        {suggestions.isError && (
          <Banner
            title="Поиск групп недоступен"
            subtitle="ТулГУ временно не отвечает. Это не означает, что группы не существует; сохранённые группы останутся доступны."
            actions={
              <Button onClick={() => void suggestions.refetch()}>
                Повторить
              </Button>
            }
          />
        )}
        {save.isError && (
          <Banner
            title={
              save.error instanceof ApiError && save.error.status === 404
                ? 'Группа не найдена'
                : 'Не удалось сохранить группу'
            }
            subtitle={
              save.error instanceof ApiError && save.error.status === 404
                ? 'ТулГУ ответил успешно, но такого номера нет в актуальном словаре.'
                : 'Проверка ТулГУ временно недоступна. Уже сохранённые группы не изменены.'
            }
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
            actions={
              <Button onClick={() => void schedule.refetch()}>Повторить</Button>
            }
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
                  {lesson.room && (
                    <Button
                      size="s"
                      mode="tertiary"
                      before={<Icon20PlaceOutline />}
                      onClick={() => {
                        setMapTargetRoom(lesson.room)
                        void navigator.push(PANEL_PATHS.map)
                      }}
                    >
                      Найти на карте
                    </Button>
                  )}
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
