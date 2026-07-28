import { apiRequest } from './client'

export interface StudentGroup {
  id: string
  code: string
  academic_year: string
  is_primary: boolean
}

export interface Tutor {
  id: string
  full_name: string
  vk_url: string
  description: string
  photo_url: string | null
  valid_until: string | null
}

export interface ResourceLink {
  id: string
  category: string
  title: string
  url: string
  description: string
  icon: string
}

export function findGroups(query: string): Promise<StudentGroup[]> {
  return apiRequest(`/groups?query=${encodeURIComponent(query)}`)
}

export function getMyGroups(): Promise<StudentGroup[]> {
  return apiRequest('/me/groups')
}

export function saveGroup(
  groupId: string,
  isPrimary = false,
): Promise<StudentGroup> {
  return apiRequest('/me/groups', {
    method: 'POST',
    body: JSON.stringify({ group_id: groupId, is_primary: isPrimary }),
  })
}

export function removeGroup(groupId: string): Promise<void> {
  return apiRequest(`/me/groups/${groupId}`, { method: 'DELETE' })
}

export function getTutors(groupId: string): Promise<Tutor[]> {
  return apiRequest(`/groups/${groupId}/tutors`)
}

export function getResources(): Promise<ResourceLink[]> {
  return apiRequest('/resources')
}

