import { apiRequest } from './client'

export interface AdminDashboard {
  upcoming_events: number
  active_registrations: number
  event_participants: number
  cancelled_events: number
  total_users: number
  new_users_7d: number
  active_users_7d: number
  feedback_total: number
  new_feedback: number
}

export interface AdminStudent {
  id: string
  vk_user_id: number
  display_name: string
  profile_url: string
  primary_group: string | null
  first_login_at: string
  last_activity_at: string | null
  launch_count: number
}

export interface AdminFeedback {
  id: string
  message: string
  status: string
  created_at: string
  user_name: string
  profile_url: string | null
}

export interface EventPayload {
  title: string
  description: string
  event_type: string
  starts_at: string
  ends_at: string
  location: string
  organizer: string
  external_url: string | null
  status: 'draft' | 'needs_review' | 'published' | 'archived'
  occurrence_status: 'scheduled' | 'moved' | 'cancelled'
  is_confirmed: boolean
}

export interface AdminEvent extends EventPayload {
  id: string
  version: number
  registration_count: number
}

export function getAdminDashboard(): Promise<AdminDashboard> {
  return apiRequest('/admin/dashboard')
}

export function getAdminStudents(): Promise<AdminStudent[]> {
  return apiRequest('/admin/users')
}

export function getAdminFeedback(): Promise<AdminFeedback[]> {
  return apiRequest('/admin/feedback')
}

export function getAdminEvents(): Promise<AdminEvent[]> {
  return apiRequest('/admin/events')
}

export function createEvent(payload: EventPayload): Promise<{ id: string }> {
  return apiRequest('/admin/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateEvent({
  id,
  payload,
}: {
  id: string
  payload: EventPayload
}): Promise<AdminEvent> {
  return apiRequest(`/admin/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteEvent(id: string): Promise<void> {
  return apiRequest(`/admin/events/${id}`, { method: 'DELETE' })
}
