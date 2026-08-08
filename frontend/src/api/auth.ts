import { apiRequest } from './client'

export interface CurrentUser {
  id: string
  vk_user_id: number
  display_name: string
  first_name: string
  last_name: string
  profile_url: string
  roles: string[]
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest('/auth/me')
}

export function getVkAvatar(vkUrl: string): Promise<{ photo_url: string | null }> {
  return apiRequest(`/auth/vk-avatar?url=${encodeURIComponent(vkUrl)}`)
}
