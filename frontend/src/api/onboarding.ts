import { apiRequest } from './client'

export interface OnboardingStep {
  id: string
  slug: string
  title: string
  description: string
  action_path: string
  sort_order: number
  completed: boolean
}

export function getOnboarding(): Promise<OnboardingStep[]> {
  return apiRequest('/onboarding')
}

export function setStepCompleted(
  stepId: string,
  completed: boolean,
): Promise<void> {
  return apiRequest(`/onboarding/${stepId}`, {
    method: 'PUT',
    body: JSON.stringify({ completed }),
  })
}

export function reportIssue(context: string, message: string): Promise<{ id: string }> {
  return apiRequest('/issues', {
    method: 'POST',
    body: JSON.stringify({ context, message }),
  })
}

