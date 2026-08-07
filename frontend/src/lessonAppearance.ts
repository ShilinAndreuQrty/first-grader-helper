export type LessonTone =
  | 'exam'
  | 'lecture'
  | 'practical'
  | 'laboratory'
  | 'special'
  | 'makeup'
  | 'neutral'

function hasShortCode(value: string, code: string): boolean {
  return new RegExp(`(^|[^а-я])${code}(?=$|[^а-я])`, 'i').test(value)
}

export function getLessonTone(
  lessonType: string,
  subject = '',
): LessonTone {
  const type = lessonType.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е')
  const title = subject.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е')

  if (type.includes('консультац')) return 'special'
  if (type.includes('отработ')) return 'makeup'
  if (
    type.includes('экзам') ||
    type.includes('зачет') ||
    type.includes('дифференц') ||
    hasShortCode(type, 'э') ||
    hasShortCode(type, 'зч') ||
    hasShortCode(type, 'дз') ||
    hasShortCode(type, 'кр')
  ) {
    return 'exam'
  }
  if (type.includes('лекц')) return 'lecture'
  if (type.includes('лаборатор')) return 'laboratory'
  if (type.includes('практическ')) return 'practical'
  if (type.includes('практик') || title.includes('практика')) return 'special'
  return 'neutral'
}

const STANDARD_LESSON_STARTS = [7 * 60 + 45, 9 * 60 + 40, 11 * 60 + 35, 13 * 60 + 40, 15 * 60 + 35, 17 * 60 + 30, 19 * 60 + 10]

export function getLessonNumber(time: string): number | undefined {
  const match = time.match(/(\d{1,2}):(\d{2})/)
  if (!match) return undefined
  const start = Number(match[1]) * 60 + Number(match[2])
  let closestIndex = 0
  for (let index = 1; index < STANDARD_LESSON_STARTS.length; index += 1) {
    if (
      Math.abs(STANDARD_LESSON_STARTS[index] - start) <
      Math.abs(STANDARD_LESSON_STARTS[closestIndex] - start)
    ) {
      closestIndex = index
    }
  }
  return Math.abs(STANDARD_LESSON_STARTS[closestIndex] - start) <= 45
    ? closestIndex + 1
    : undefined
}

export function formatLessonType(lessonType: string): string {
  const value = lessonType.trim()
  if (/^э\s+консультации?$/i.test(value)) return 'Консультация к экзамену'
  if (/^дз\s+по\s+практике$/i.test(value)) return 'Дифзачёт по практике'
  if (/^э$/i.test(value)) return 'Экзамен'
  if (/^дз$/i.test(value)) return 'Дифзачёт'
  if (/^зч$/i.test(value)) return 'Зачёт'
  if (/^кр$/i.test(value)) return 'Курсач'
  return value
}
