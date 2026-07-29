import { apiRequest } from './client'

export interface FaqCategory {
  id: string
  title: string
  count: number
}

export interface FaqEntry {
  id: string
  question: string
  answer_markdown: string
  category: string
  source_url: string | null
  verified_at: string | null
  is_time_sensitive: boolean
}

export interface AssistantSuggestion {
  faq_id: string
  question: string
  category: string
}

export interface AssistantResponse {
  type: 'answer' | 'suggestions' | 'clarification' | 'not_found'
  answer: FaqEntry | null
  message: string | null
  faq_ids: string[]
  suggestions: AssistantSuggestion[]
  confidence: 'high' | 'medium' | 'low'
  sources: Array<{
    title: string
    url: string | null
    verified_at: string | null
  }>
  verified_at: string | null
  mode: 'retrieval' | 'grounded_ai'
}

export function getFaqCategories(): Promise<FaqCategory[]> {
  return apiRequest('/faq/categories')
}

export function getFaq(categoryId?: string, query?: string): Promise<FaqEntry[]> {
  const params = new URLSearchParams()
  if (categoryId) params.set('category_id', categoryId)
  if (query?.trim()) params.set('query', query.trim())
  const suffix = params.size ? `?${params.toString()}` : ''
  return apiRequest(`/faq${suffix}`)
}

export function askAssistant(
  text: string,
  selectedFaqId?: string,
): Promise<AssistantResponse> {
  return apiRequest('/assistant/query', {
    method: 'POST',
    body: JSON.stringify({
      text,
      session_id: getAssistantSessionId(),
      selected_faq_id: selectedFaqId,
    }),
  })
}

export function sendFaqFeedback(
  faqId: string,
  isHelpful: boolean,
): Promise<{ id: string }> {
  return apiRequest(`/faq/${faqId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ is_helpful: isHelpful, comment: '' }),
  })
}

function getAssistantSessionId(): string {
  const key = 'ipmkn.assistant-session'
  const current = sessionStorage.getItem(key)
  if (current) return current
  const created = crypto.randomUUID()
  sessionStorage.setItem(key, created)
  return created
}
