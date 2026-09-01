const KEY_PREFIX = 'ipmkn.onboardingDismissed'

export function isOnboardingDismissed(userId: string): boolean {
  return localStorage.getItem(`${KEY_PREFIX}:${userId}`) === '1'
}

export function dismissOnboarding(userId: string): void {
  localStorage.setItem(`${KEY_PREFIX}:${userId}`, '1')
}
