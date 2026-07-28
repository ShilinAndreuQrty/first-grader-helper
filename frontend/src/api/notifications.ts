import { apiRequest } from './client'

export interface PublicConfig {
  app_name: string
  environment: string
  vk_enabled: boolean
  notifications_enabled: boolean
  vk_community_id: number | null
  assistant_mode: string
}

export interface NotificationPreferences {
  union_meetings: boolean
  selected_events: boolean
  announcements: boolean
  minutes_before: number
  in_app_enabled: boolean
  vk_notifications_enabled: boolean
  community_messages_enabled: boolean
}

export function getPublicConfig(): Promise<PublicConfig> {
  return apiRequest('/config')
}

export function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiRequest('/me/notification-preferences')
}

export function updateNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  return apiRequest('/me/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  })
}

