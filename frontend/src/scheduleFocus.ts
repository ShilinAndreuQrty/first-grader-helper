import { ScheduleLesson } from './api/schedule'

const MOSCOW_TIME_ZONE = 'Europe/Moscow'

function lessonKey(lesson: ScheduleLesson, index: number): string {
  return `${lesson.date}-${lesson.time}-${index}`
}

function moscowDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function moscowMinutes(now: Date): number {
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

function lessonEndMinutes(time: string): number {
  const matches = [...time.matchAll(/(\d{1,2}):(\d{2})/g)]
  const end = matches.at(-1)
  return end ? Number(end[1]) * 60 + Number(end[2]) : Number.POSITIVE_INFINITY
}

export function getScheduleLessonKey(
  lesson: ScheduleLesson,
  index: number,
): string {
  return lessonKey(lesson, index)
}

export function getMoscowDate(now = new Date()): string {
  return moscowDate(now)
}

export function getScheduleFocusKey(
  lessons: ScheduleLesson[],
  now = new Date(),
): string | undefined {
  const indexed = lessons.map((lesson, index) => ({ lesson, index }))
  if (indexed.length === 0) return undefined

  const today = moscowDate(now)
  const todayLessons = indexed.filter(({ lesson }) => lesson.date === today)
  if (todayLessons.length > 0) {
    const minutes = moscowMinutes(now)
    const currentOrNext = todayLessons.find(
      ({ lesson }) => lessonEndMinutes(lesson.time) >= minutes,
    )
    const target = currentOrNext ?? todayLessons.at(-1)!
    return lessonKey(target.lesson, target.index)
  }

  const next = indexed.find(({ lesson }) => lesson.date > today)
  const target = next ?? indexed.at(-1)!
  return lessonKey(target.lesson, target.index)
}
