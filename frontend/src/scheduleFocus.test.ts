import { describe, expect, it } from 'vitest'

import { ScheduleLesson } from './api/schedule'
import { getScheduleFocusKey } from './scheduleFocus'

function lesson(date: string, time: string): ScheduleLesson {
  return {
    date,
    time,
    subject: time,
    lesson_type: '',
    room: '',
    teacher: '',
  }
}

describe('getScheduleFocusKey', () => {
  it('selects the current or next lesson today in Moscow', () => {
    const lessons = [
      lesson('2026-08-07', '07:45 - 09:20'),
      lesson('2026-08-07', '09:40 - 11:15'),
      lesson('2026-08-07', '11:35 - 13:10'),
    ]

    expect(
      getScheduleFocusKey(lessons, new Date('2026-08-07T07:00:00Z')),
    ).toBe('2026-08-07-09:40 - 11:15-1')
  })

  it('selects the last lesson when todays lessons are over', () => {
    const lessons = [
      lesson('2026-08-07', '07:45 - 09:20'),
      lesson('2026-08-07', '09:40 - 11:15'),
    ]

    expect(
      getScheduleFocusKey(lessons, new Date('2026-08-07T18:00:00Z')),
    ).toBe('2026-08-07-09:40 - 11:15-1')
  })

  it('falls back to the nearest date when there are no lessons today', () => {
    const lessons = [
      lesson('2026-08-05', '09:40 - 11:15'),
      lesson('2026-08-10', '11:35 - 13:10'),
    ]

    expect(
      getScheduleFocusKey(lessons, new Date('2026-08-07T09:00:00Z')),
    ).toBe('2026-08-10-11:35 - 13:10-1')
  })
})
