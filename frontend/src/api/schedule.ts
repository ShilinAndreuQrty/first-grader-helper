import { StudentGroup } from './students'
import { apiRequest } from './client'

export interface ScheduleLesson {
  date: string
  time: string
  subject: string
  lesson_type: string
  room: string
  teacher: string
}

export interface GroupSchedule {
  group_code: string
  lessons: ScheduleLesson[]
  fetched_at: string
  is_stale: boolean
  source_url: string
}

export interface GroupSuggestions {
  groups: string[]
  fetched_at: string
  is_stale: boolean
}

export function findScheduleGroups(query: string): Promise<GroupSuggestions> {
  return apiRequest(`/schedule/groups?query=${encodeURIComponent(query)}`)
}

export function saveGroupByCode(
  code: string,
  isPrimary: boolean,
  label?: string,
): Promise<StudentGroup> {
  return apiRequest('/me/groups/by-code', {
    method: 'POST',
    body: JSON.stringify({
      code,
      is_primary: isPrimary,
      ...(label === undefined ? {} : { label }),
    }),
  })
}

export function getSchedule(groupCode: string): Promise<GroupSchedule> {
  return apiRequest(`/schedule/${encodeURIComponent(groupCode)}`)
}
