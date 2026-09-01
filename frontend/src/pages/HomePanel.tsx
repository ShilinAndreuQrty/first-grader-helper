import {
  Icon20ChevronRight,
  Icon20ClockOutline,
  Icon28LinkOutline,
  Icon28MessageOutline,
  Icon28UserCardOutline,
  Icon28Users3Outline,
} from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import { Button, Div, Input, Panel, Text, Title } from '@vkontakte/vkui'
import { useEffect, useState } from 'react'

import { getOnboarding } from '../api/onboarding'
import { getCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import { getSchedule, saveGroupByCode, ScheduleLesson } from '../api/schedule'
import { getMyGroups, getTutors } from '../api/students'
import { AppPanelHeader } from '../components/AppPanelHeader'
import ipmknLogo from '../assets/ipmkn-logo.png'
import { isValidGroupCode, normalizeGroupCode } from '../groupCode'
import { formatLessonType } from '../lessonAppearance'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'
import { setMoreReturnPath } from '../navigation'
import { getLessonTiming, getMoscowDate } from '../scheduleFocus'
import { isOnboardingDismissed } from '../onboardingDismissal'

const MOSCOW_TIME_ZONE = 'Europe/Moscow'
const PROFBUREAU_URL = 'https://vk.ru/profburo_ipmkn_tsu'

function getMoscowMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: 'hour' | 'minute') =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return value('hour') * 60 + value('minute')
}

function getLessonEndMinutes(time: string): number {
  const matches = [...time.matchAll(/(\d{1,2}):(\d{2})/g)]
  const end = matches.at(-1)
  return end ? Number(end[1]) * 60 + Number(end[2]) : Number.POSITIVE_INFINITY
}

function formatRemaining(minutes: number): string {
  if (minutes < 60) return `Осталось ${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `Осталось ${hours} ч${rest ? ` ${rest} мин` : ''}`
}

function getUpcomingLesson(
  lessons: ScheduleLesson[],
  now = new Date(),
): ScheduleLesson | undefined {
  const today = getMoscowDate(now)
  const minutes = getMoscowMinutes(now)
  return lessons.find(
    (lesson) =>
      lesson.date > today ||
      (lesson.date === today && getLessonEndMinutes(lesson.time) >= minutes),
  )
}

function getGreeting(now = new Date()): string {
  const hour = Math.floor(getMoscowMinutes(now) / 60)
  if (hour < 6) return 'Доброй ночи!'
  if (hour < 12) return 'Доброе утро!'
  if (hour < 18) return 'Добрый день!'
  return 'Добрый вечер!'
}

function formatHomeDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function HomePanel({ id = 'home' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => new Date())
  const [groupCode, setGroupCode] = useState('')
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const groups = useQuery({ queryKey: ['my-groups'], queryFn: getMyGroups })
  const onboarding = useQuery({
    queryKey: ['onboarding'],
    queryFn: getOnboarding,
  })
  const currentUser = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  })
  const primaryGroup = groups.data?.find((group) => group.is_primary)
  const tutors = useQuery({
    queryKey: ['tutors', primaryGroup?.id],
    queryFn: () => getTutors(primaryGroup!.id),
    enabled: Boolean(primaryGroup),
  })
  const hasTutor = Boolean(primaryGroup && tutors.data?.length)
  const normalizedGroupCode = normalizeGroupCode(groupCode)
  const savePrimaryGroup = useMutation({
    mutationFn: () => saveGroupByCode(normalizedGroupCode, true),
    onSuccess: () => {
      setGroupCode('')
      void queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })
  const schedule = useQuery({
    queryKey: ['schedule', primaryGroup?.code],
    queryFn: () => getSchedule(primaryGroup!.code),
    enabled: Boolean(primaryGroup),
  })
  const nextStep = onboarding.data?.find((step) => !step.completed)
  const completedSteps =
    onboarding.data?.filter((step) => step.completed).length ?? 0
  const totalSteps = onboarding.data?.length ?? 0
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
  const onboardingDismissed = currentUser.data
    ? isOnboardingDismissed(currentUser.data.id)
    : false
  const today = getMoscowDate(now)
  const upcomingLesson = getUpcomingLesson(schedule.data?.lessons ?? [], now)
  const upcomingIsToday = upcomingLesson?.date === today
  const todayLessonCount =
    schedule.data?.lessons.filter((lesson) => lesson.date === today).length ?? 0
  const currentMinutes = getMoscowMinutes(now)
  const lessonTiming = upcomingIsToday && upcomingLesson
    ? getLessonTiming(upcomingLesson.time, currentMinutes)
    : { isInProgress: false, progress: 0, remainingMinutes: 0 }

  return (
    <Panel id={id} className="home-panel">
      <AppPanelHeader>Главная</AppPanelHeader>
      <Div className="home-dashboard">
        <div
          className={`home-spotlight${primaryGroup ? ' home-spotlight--linked' : ''}`}
          onClick={primaryGroup
            ? () => void navigator.push(PANEL_PATHS.schedule)
            : undefined}
          onKeyDown={primaryGroup
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void navigator.push(PANEL_PATHS.schedule)
                }
              }
            : undefined}
          role={primaryGroup ? 'button' : undefined}
          tabIndex={primaryGroup ? 0 : undefined}
        >
          <div className="home-spotlight__welcome">
            <img className="home-spotlight__logo" src={ipmknLogo} alt="" aria-hidden />
            <Text className="home-spotlight__date">{formatHomeDate(today)}</Text>
            <Title level="1">{getGreeting(now)}</Title>
            {!primaryGroup && (
              <Text className="home-spotlight__lead">
                Добавьте группу — и здесь появится ваше расписание.
              </Text>
            )}
          </div>

          <div className="home-spotlight__schedule">
            {!primaryGroup ? (
              <div className="home-spotlight__setup">
                <span className="home-spotlight__lesson">
                  <strong>Выбрать свою группу</strong>
                  <small>Один раз — и расписание всегда будет под рукой.</small>
                </span>
                <form
                  className="home-group-picker"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (isValidGroupCode(normalizedGroupCode)) {
                      savePrimaryGroup.mutate()
                    }
                  }}
                >
                  <Input
                    aria-label="Номер своей группы"
                    value={groupCode}
                    placeholder="Например, 221451"
                    inputMode="numeric"
                    status={
                      groupCode && !isValidGroupCode(normalizedGroupCode)
                        ? 'error'
                        : 'default'
                    }
                    onChange={(event) => setGroupCode(event.target.value)}
                  />
                  <Button
                    type="submit"
                    size="l"
                    stretched
                    loading={savePrimaryGroup.isPending}
                    disabled={!isValidGroupCode(normalizedGroupCode)}
                  >
                    Сохранить группу
                  </Button>
                  {savePrimaryGroup.error && (
                    <Text className="home-group-picker__error">
                      {savePrimaryGroup.error instanceof ApiError
                        ? savePrimaryGroup.error.message
                        : 'Не удалось сохранить группу. Попробуйте ещё раз.'}
                    </Text>
                  )}
                </form>
              </div>
            ) : schedule.isLoading ? (
              <span className="home-spotlight__lesson">
                <strong>Загружаем занятия…</strong>
              </span>
            ) : upcomingLesson ? (
              <>
                <span className="home-spotlight__lesson">
                  <small>
                    {lessonTiming.isInProgress
                      ? 'Пара идёт сейчас'
                      : upcomingIsToday
                        ? 'Ближайшая пара'
                        : 'Дальше в расписании'}
                  </small>
                  <strong>{upcomingLesson.subject}</strong>
                  <span className="home-spotlight__meta">
                    <span className="home-spotlight__meta-row">
                      <Icon20ClockOutline aria-hidden />
                      {[
                        !upcomingIsToday && formatHomeDate(upcomingLesson.date),
                        upcomingLesson.time,
                      ].filter(Boolean).join(' · ')}
                    </span>
                    <span className="home-spotlight__meta-row">
                      {[
                        formatLessonType(upcomingLesson.lesson_type),
                        upcomingLesson.room,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>
                {lessonTiming.isInProgress && (
                  <span className="home-lesson-timer">
                    <span className="home-lesson-timer__labels">
                      <strong>{formatRemaining(lessonTiming.remainingMinutes)}</strong>
                      <small>{Math.round(lessonTiming.progress)}%</small>
                    </span>
                    <span className="home-lesson-timer__track" aria-hidden>
                      <span style={{ width: `${lessonTiming.progress}%` }} />
                    </span>
                  </span>
                )}
              </>
            ) : (
              <span className="home-spotlight__lesson">
                <strong>Сегодня занятий нет</strong>
                <span className="home-spotlight__meta">
                  {todayLessonCount > 0
                    ? 'Все пары на сегодня уже закончились.'
                    : 'Посмотрите следующие дни в расписании.'}
                </span>
              </span>
            )}
            {primaryGroup && (
              <span className="home-spotlight__footer">
                <span className="home-spotlight__footer-copy">
                  <strong>Расписание</strong>
                  <span aria-hidden>·</span>
                  <span>
                    {primaryGroup.label || `Группа ${primaryGroup.code}`}
                  </span>
                  {primaryGroup.label && (
                    <>
                      <span aria-hidden>·</span>
                      <small>{primaryGroup.code}</small>
                    </>
                  )}
                </span>
                <span className="home-spotlight__arrow">
                  <Icon20ChevronRight aria-hidden />
                </span>
              </span>
            )}
          </div>
        </div>

        <section className="home-section" aria-label="Быстрые действия">
          <div className="home-actions">
            <button
              type="button"
              className="home-action home-action--assistant"
              onClick={() => void navigator.push(PANEL_PATHS.assistant)}
            >
              <span className="home-action__icon"><Icon28MessageOutline /></span>
              <span><strong>Спросить помощника</strong><small>Ответы про учёбу и институт</small></span>
              <Icon20ChevronRight className="home-action__arrow" aria-hidden />
            </button>
            <button
              type="button"
              className="home-action home-action--account"
              onClick={() => void openExternalUrl('https://lk.tsu.tula.ru:3443/lk/')}
            >
              <span className="home-action__icon"><Icon28UserCardOutline /></span>
              <span><strong>Личный кабинет</strong><small>ЛК ТулГУ</small></span>
            </button>
            {hasTutor ? (
              <button
                type="button"
                className="home-action home-action--tutor"
                onClick={() => {
                  sessionStorage.setItem('ipmkn.moreTarget', 'my-tutor')
                  setMoreReturnPath(PANEL_PATHS.home)
                  void navigator.push(PANEL_PATHS.more)
                }}
              >
                <span className="home-action__icon"><Icon28Users3Outline /></span>
                <span><strong>Мой тьютор</strong><small>Контакт наставника</small></span>
              </button>
            ) : (
              <button
                type="button"
                className="home-action home-action--tutor"
                onClick={() => void openExternalUrl(PROFBUREAU_URL)}
              >
                <span className="home-action__icon"><Icon28Users3Outline /></span>
                <span><strong>Профбюро ИПМКН</strong><small>Новости и помощь студентам</small></span>
              </button>
            )}
            <button
              type="button"
              className="home-action home-action--links home-action--wide"
              onClick={() => void navigator.push(PANEL_PATHS.resources)}
            >
              <span className="home-action__icon"><Icon28LinkOutline /></span>
              <span><strong>Полезные ссылки</strong><small>Сервисы и сообщества</small></span>
              <Icon20ChevronRight className="home-action__arrow" aria-hidden />
            </button>
          </div>
        </section>

        {primaryGroup && totalSteps > 0 && !onboardingDismissed && (
          <button
            type="button"
            className="home-progress-card"
            onClick={() => void navigator.push(PANEL_PATHS.onboarding)}
          >
            <span className="home-progress-card__topline">
              <strong>Знакомство с приложением</strong>
              <small>{completedSteps} из {totalSteps}</small>
            </span>
            <span className="home-progress-card__track" aria-hidden>
              <span style={{ width: `${progress}%` }} />
            </span>
            <span className="home-progress-card__next">
              {nextStep ? (
                <span><small>Следующий шаг</small><strong>{nextStep.title}</strong></span>
              ) : (
                <span><small>Все шаги выполнены</small><strong>Знакомство завершено</strong></span>
              )}
              <Icon20ChevronRight aria-hidden />
            </span>
          </button>
        )}

        <footer className="home-disclaimer">
          Приложение создано тьюторским сообществом ИПМКН и не заменяет официальные сообщения ТулГУ.
        </footer>
      </Div>
    </Panel>
  )
}
