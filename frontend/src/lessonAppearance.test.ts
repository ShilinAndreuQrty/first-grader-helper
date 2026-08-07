import { describe, expect, it } from 'vitest'

import {
  formatLessonType,
  getLessonNumber,
  getLessonTone,
} from './lessonAppearance'

describe('getLessonTone', () => {
  it.each([
    ['Лекции', '', 'lecture'],
    ['Практические занятия', '', 'practical'],
    ['Лабораторные занятия', '', 'laboratory'],
    ['Э', '', 'exam'],
    ['зч', '', 'exam'],
    ['ДЗ', '', 'exam'],
    ['КР', '', 'exam'],
    ['Э консультации', '', 'special'],
    ['Практика', '', 'special'],
    ['', 'Технологическая практика', 'special'],
    ['Отработка', '', 'makeup'],
  ])('maps %s / %s to %s', (lessonType, subject, tone) => {
    expect(getLessonTone(lessonType, subject)).toBe(tone)
  })

  it.each([
    ['Э', 'Экзамен'],
    ['ДЗ', 'Дифзачёт'],
    ['зч', 'Зачёт'],
    ['КР', 'Курсач'],
    ['Э консультации', 'Консультация к экзамену'],
    ['ДЗ по практике', 'Дифзачёт по практике'],
    ['Лекции', 'Лекции'],
  ])('expands %s as %s', (source, label) => {
    expect(formatLessonType(source)).toBe(label)
  })

  it.each([
    ['07:45 - 09:20', 1],
    ['09:40 - 11:15', 2],
    ['11:35 - 13:10', 3],
    ['13:40 - 15:15', 4],
    ['15:35 - 17:10', 5],
    ['17:30 - 19:00', 6],
    ['08:00 - 10:55', 1],
    ['11:00 - 13:55', 3],
    ['14:00 - 16:55', 4],
  ])('maps %s to lesson %s', (time, number) => {
    expect(getLessonNumber(time)).toBe(number)
  })
})
