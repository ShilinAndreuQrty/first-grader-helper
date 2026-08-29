import {
  Icon20PlaceOutline,
  Icon24ArrowDownOutline,
  Icon24ArrowUpOutline,
  Icon24ShareExternalOutline,
} from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useActiveVkuiLocation,
  useRouteNavigator,
} from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  ButtonGroup,
  Card,
  CardGrid,
  Div,
  Group,
  Header,
  Input,
  Link,
  Panel,
  PanelHeaderButton,
  Placeholder,
  Search,
  Spinner,
  Text,
  Title,
} from '@vkontakte/vkui'
import { useEffect, useMemo, useState } from 'react'

import {
  getSchedule,
  ScheduleLesson,
  saveGroupByCode,
} from '../api/schedule'
import { getMyGroups, removeGroup, saveGroup } from '../api/students'
import { setMapTargetRoom } from '../campusLocation'
import { AppPanelHeader } from '../components/AppPanelHeader'
import {
  GROUP_CODE_HINT,
  isValidGroupCode,
  normalizeGroupCode,
} from '../groupCode'
import {
  formatLessonType,
  getLessonNumber,
  getLessonTone,
} from '../lessonAppearance'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'
import {
  getMoscowDate,
  getScheduleFocusKey,
  getScheduleLessonKey,
} from '../scheduleFocus'

function formatScheduleUpdate(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const OFFICIAL_SCHEDULE_URL = 'https://tulsu.ru/schedule/'

export function SchedulePanel({ id = 'schedule' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const { panel } = useActiveVkuiLocation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [editingGroupId, setEditingGroupId] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
  const [todayDirection, setTodayDirection] = useState<'up' | 'down' | null>(
    null,
  )
  const normalizedSearch = useMemo(() => normalizeGroupCode(search), [search])
  const hasValidSearch = isValidGroupCode(normalizedSearch)
  const saved = useQuery({ queryKey: ['my-groups'], queryFn: getMyGroups })
  const primary = saved.data?.find((group) => group.is_primary)
  const activeCode = selectedCode || primary?.code || ''
  const activeGroup = saved.data?.find((group) => group.code === activeCode)
  const officialScheduleUrl = activeCode
    ? `${OFFICIAL_SCHEDULE_URL}?search=${encodeURIComponent(activeCode)}`
    : OFFICIAL_SCHEDULE_URL
  const schedule = useQuery({
    queryKey: ['schedule', activeCode],
    queryFn: () => getSchedule(activeCode),
    enabled: Boolean(activeCode),
  })
  const save = useMutation({
    mutationFn: ({ code, isPrimary }: { code: string; isPrimary: boolean }) =>
      saveGroupByCode(code, isPrimary),
    onSuccess: (group) => {
      setSelectedCode(group.code)
      setSearch('')
      void queryClient.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
  const deleteSaved = useMutation({
    mutationFn: removeGroup,
    onSuccess: (_, groupId) => {
      const removed = saved.data?.find((group) => group.id === groupId)
      if (removed?.code === selectedCode) setSelectedCode('')
      void queryClient.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
  const renameGroup = useMutation({
    mutationFn: ({ groupId, label }: { groupId: string; label: string }) =>
      saveGroup(groupId, false, label),
    onSuccess: () => {
      setEditingGroupId('')
      setLabelDraft('')
      void queryClient.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
  const today = getMoscowDate()
  const scheduleDays = useMemo(() => {
    const days = new Map<
      string,
      Array<{ lesson: ScheduleLesson; index: number; key: string }>
    >()
    for (const [index, lesson] of (schedule.data?.lessons ?? []).entries()) {
      const entries = days.get(lesson.date) ?? []
      entries.push({ lesson, index, key: getScheduleLessonKey(lesson, index) })
      days.set(lesson.date, entries)
    }
    if (schedule.data && !days.has(today)) days.set(today, [])
    return [...days.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, lessons]) => ({ date, lessons }))
  }, [schedule.data, today])
  const focusKey = useMemo(
    () => getScheduleFocusKey(schedule.data?.lessons ?? []),
    [schedule.data?.lessons],
  )
  const autoScrollKey = schedule.data
    ? `${schedule.data.group_code}:${schedule.data.fetched_at}:${today}`
    : ''

  useEffect(() => {
    if (panel !== 'schedule' || !autoScrollKey) return

    let hasScrolled = false
    const scrollToCurrentDay = () => {
      if (hasScrolled) return
      const todaySection = document.getElementById('schedule-today')
      if (!todaySection) return
      hasScrolled = true
      const controlsBottom = document
        .querySelector('.schedule-sticky-controls')
        ?.getBoundingClientRect().bottom ?? 138
      window.scrollTo({
        top:
          window.scrollY +
          todaySection.getBoundingClientRect().top -
          controlsBottom -
          10,
        behavior: 'smooth',
      })
    }

    const view = document.querySelector('.vkuiView__panelActive')
    const handleTransitionEnd = () => scrollToCurrentDay()
    view?.addEventListener('transitionend', handleTransitionEnd, { once: true })
    const fallback = window.setTimeout(scrollToCurrentDay, 400)

    return () => {
      view?.removeEventListener('transitionend', handleTransitionEnd)
      window.clearTimeout(fallback)
    }
  }, [autoScrollKey, panel])

  useEffect(() => {
    const updateDirection = () => {
      const section = document.getElementById('schedule-today')
      if (!section) {
        setTodayDirection(null)
        return
      }
      const bounds = section.getBoundingClientRect()
      if (bounds.bottom < 120) setTodayDirection('up')
      else if (bounds.top > window.innerHeight - 100) setTodayDirection('down')
      else setTodayDirection(null)
    }
    const frame = window.requestAnimationFrame(updateDirection)
    window.addEventListener('scroll', updateDirection, { passive: true })
    window.addEventListener('resize', updateDirection)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateDirection)
      window.removeEventListener('resize', updateDirection)
    }
  }, [activeCode, scheduleDays])

  const scrollToToday = () => {
    document.getElementById('schedule-today')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return (
    <Panel id={id}>
      <AppPanelHeader
        backToHome
        beforeMenu={
          <PanelHeaderButton
            aria-label="Открыть официальное расписание"
            onClick={() => void openExternalUrl(
              schedule.data?.source_url || officialScheduleUrl,
            )}
          >
            <Icon24ShareExternalOutline />
          </PanelHeaderButton>
        }
      >
        Расписание
      </AppPanelHeader>
      <div className="schedule-sticky-controls">
        <details className="schedule-group-picker">
          <summary className="schedule-group-picker__summary">
            <span className="schedule-group-picker__summary-copy">
              <Title level="3">
                {activeGroup?.label || activeCode || 'Выберите группу'}
              </Title>
              <Text className="muted">
                {activeGroup?.label && `${activeCode} · `}
                {schedule.data
                  ? `Обновлено ${formatScheduleUpdate(schedule.data.fetched_at)}`
                  : 'Выбор расписания'}
              </Text>
            </span>
            <span className="schedule-group-picker__chevron" aria-hidden />
          </summary>

          <div className="schedule-group-picker__menu">
            <Header>Сохранённые группы</Header>
            {saved.data?.map((group) => (
              <div
                key={group.id}
                className={`schedule-group-option${
                  activeCode === group.code ? ' schedule-group-option--active' : ''
                }`}
              >
                <div className="schedule-group-option__main">
                  <button
                    type="button"
                    className="schedule-group-option__select"
                    onClick={() => setSelectedCode(group.code)}
                  >
                    <span className="schedule-group-option__title">
                      {group.label || `Группа ${group.code}`}
                    </span>
                    <span className="schedule-group-option__meta">
                      {group.code}
                    </span>
                  </button>
                  <div className="schedule-group-option__actions">
                    <Button
                      size="s"
                      mode="tertiary"
                      onClick={() => {
                        setEditingGroupId(group.id)
                        setLabelDraft(group.label)
                      }}
                    >
                      {group.label ? 'Изменить подпись' : 'Подписать'}
                    </Button>
                    {!group.is_primary && (
                      <Button
                        size="s"
                        mode="tertiary"
                        loading={deleteSaved.isPending}
                        onClick={() => deleteSaved.mutate(group.id)}
                      >
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
                {editingGroupId === group.id && (
                  <form
                    className="schedule-group-option__editor"
                    onSubmit={(event) => {
                      event.preventDefault()
                      renameGroup.mutate({ groupId: group.id, label: labelDraft })
                    }}
                  >
                    <Input
                      aria-label={`Подпись для группы ${group.code}`}
                      value={labelDraft}
                      maxLength={60}
                      placeholder="Например, группа Ксюши"
                      onChange={(event) => setLabelDraft(event.target.value)}
                    />
                    <ButtonGroup mode="horizontal" gap="s">
                      <Button type="submit" size="s" loading={renameGroup.isPending}>
                        Сохранить
                      </Button>
                      <Button
                        type="button"
                        size="s"
                        mode="tertiary"
                        onClick={() => setEditingGroupId('')}
                      >
                        Отмена
                      </Button>
                    </ButtonGroup>
                  </form>
                )}
              </div>
            ))}

            <div className="schedule-group-picker__search">
              <Header>Добавить группу</Header>
              <Search
                value={search}
                placeholder="Например, 220031-22"
                onChange={(event) => setSearch(event.target.value)}
              />
              {search.length > 0 && !hasValidSearch && (
                <Banner title="Проверьте формат номера" subtitle={GROUP_CODE_HINT} />
              )}
              {hasValidSearch && (
                <Button
                  size="l"
                  stretched
                  loading={save.isPending}
                  onClick={() =>
                    save.mutate({
                      code: normalizedSearch,
                      isPrimary: !primary,
                    })
                  }
                >
                  Добавить группу {normalizedSearch}
                </Button>
              )}
              {save.isError && (
                <Banner
                  title="Не удалось сохранить группу"
                  subtitle="Уже сохранённые группы не изменены."
                />
              )}
              {renameGroup.isError && (
                <Banner title="Не удалось сохранить подпись" />
              )}
            </div>
          </div>
        </details>
        {schedule.data?.is_stale && (
          <div className="schedule-stale-notice">
            <Banner
              title="Показана сохранённая копия"
              subtitle="Сервис ТулГУ сейчас недоступен. Время последнего обновления указано выше."
            />
          </div>
        )}
      </div>
      {!activeCode && (
        <Group className="schedule-empty-state">
          <Banner
            title="Сначала выберите группу"
            subtitle="Начните вводить официальный номер выше. Выбор сохранится в профиле."
          />
        </Group>
      )}
      {schedule.isFetching && <Spinner size="m" />}
      {schedule.isError && (
        <Group>
          <Banner
            title="Расписание временно недоступно"
            subtitle="Для этой группы ещё нет сохранённой копии. Попробуйте позднее."
            actions={
              <Button
                loading={schedule.isFetching}
                onClick={() => void schedule.refetch()}
              >
                Повторить
              </Button>
            }
          />
        </Group>
      )}
      {schedule.data && (
        <Group>
          {schedule.data.lessons.length === 0 && (
            <Placeholder>На опубликованный период занятий нет.</Placeholder>
          )}
          <div className="schedule-days">
            {scheduleDays.map(({ date, lessons }) => (
              <section
                id={date === today ? 'schedule-today' : undefined}
                key={date}
                className={`schedule-day${date === today ? ' schedule-day--today' : ''}`}
              >
                <div className="schedule-day__divider">
                  <Title level="3">
                    {new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Title>
                </div>
                {date === today && lessons.length === 0 && (
                  <Text className="schedule-day__empty-text">Занятий нет</Text>
                )}
                <CardGrid size="l">
                  {lessons.map(({ lesson, key }) => {
                    const hasMapLocation =
                      Boolean(lesson.room) &&
                      !/^без аудитории$/i.test(lesson.room.trim())
                    const lessonTone = getLessonTone(
                      lesson.lesson_type,
                      lesson.subject,
                    )
                    const lessonNumber = getLessonNumber(lesson.time)
                    const cardClasses = [
                      `lesson-card--${lessonTone}`,
                      key === focusKey ? 'lesson-card--focus' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <Card
                        id={key === focusKey ? 'schedule-focus' : undefined}
                        key={`${lesson.subject}-${key}`}
                        className={cardClasses}
                        mode="outline"
                      >
                        <Div className="lesson-card">
                          <div className="lesson-card__content">
                            <Title level="3">{lesson.subject}</Title>
                            <Text className="lesson-time">
                              {lesson.time}
                              {lesson.lesson_type && (
                                <>
                                  {' · '}
                                  <span className="lesson-type">
                                    {formatLessonType(lesson.lesson_type)}
                                  </span>
                                </>
                              )}
                            </Text>
                            <Text className="lesson-meta">
                              {hasMapLocation ? (
                                <Link
                                  href="#/map"
                                  className="lesson-location-link"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    setMapTargetRoom(lesson.room)
                                    void navigator.push(PANEL_PATHS.map)
                                  }}
                                >
                                  <Icon20PlaceOutline aria-hidden />
                                  {lesson.room}
                                </Link>
                              ) : (
                                lesson.room && (
                                  <span className="lesson-room">{lesson.room}</span>
                                )
                              )}
                              {lesson.teacher && (
                                <span className="lesson-teacher">
                                  {lesson.teacher}
                                </span>
                              )}
                            </Text>
                          </div>
                          {lessonNumber && (
                            <div
                              className="lesson-card__number"
                              aria-label={`${lessonNumber}-я пара`}
                            >
                              {lessonNumber}
                            </div>
                          )}
                        </Div>
                      </Card>
                    )
                  })}
                </CardGrid>
              </section>
            ))}
          </div>
          <div className="schedule-scroll-tail" aria-hidden />
        </Group>
      )}
      {todayDirection && (
        <button
          type="button"
          className="schedule-today-fab"
          aria-label="Перейти к сегодняшнему дню"
          onClick={scrollToToday}
        >
          {todayDirection === 'up' ? (
            <Icon24ArrowUpOutline />
          ) : (
            <Icon24ArrowDownOutline />
          )}
        </button>
      )}
    </Panel>
  )
}
