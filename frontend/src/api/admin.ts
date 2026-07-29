import { apiRequest } from './client'

export interface AdminDashboard {
  needs_review_faq: number
  upcoming_events: number
  failed_assistant_queries: number
  unconfirmed_series: number
  recent_audit: number
  open_issue_reports: number
}

export interface AdminFaq {
  id: string
  question: string
  status: string
  version: number
  verified_at: string | null
  is_time_sensitive: boolean
}

export interface AdminStudent {
  id: string
  vk_user_id: number
  display_name: string
  profile_url: string
  primary_group: string | null
  first_login_at: string
  last_activity_at: string | null
}

export interface EventDraft {
  title: string
  starts_at: string
  ends_at: string
  location: string
}

export function getAdminDashboard(): Promise<AdminDashboard> {
  return apiRequest('/admin/dashboard')
}

export function getAdminFaq(): Promise<AdminFaq[]> {
  return apiRequest('/admin/faq')
}

export function getAdminStudents(): Promise<AdminStudent[]> {
  return apiRequest('/admin/users')
}

export function createEvent(draft: EventDraft): Promise<{ id: string }> {
  return apiRequest('/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      ...draft,
      starts_at: new Date(draft.starts_at).toISOString(),
      ends_at: new Date(draft.ends_at).toISOString(),
      event_type: 'other',
      status: 'draft',
      description: '',
      organizer: '',
      is_confirmed: true,
    }),
  })
}
