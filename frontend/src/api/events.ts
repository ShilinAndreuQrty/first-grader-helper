import { apiRequest } from './client'

export interface EventOccurrence {
  occurrence_id: string
  event_id: string | null
  series_id: string | null
  title: string
  description: string
  event_type: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string
  organizer: string
  external_url: string | null
  status: 'scheduled' | 'moved' | 'cancelled' | 'completed'
  is_confirmed: boolean
}

export function getEvents(eventType?: string): Promise<EventOccurrence[]> {
  const suffix = eventType
    ? `?event_type=${encodeURIComponent(eventType)}`
    : ''
  return apiRequest(`/events${suffix}`)
}

export function getSubscribedEventIds(): Promise<string[]> {
  return apiRequest('/me/event-subscriptions')
}

export function subscribeToEvent(
  event: EventOccurrence,
): Promise<{ id: string }> {
  return apiRequest('/event-subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      event_id: event.event_id,
      series_id: event.series_id,
      occurrence_start: event.series_id ? event.starts_at : null,
    }),
  })
}

