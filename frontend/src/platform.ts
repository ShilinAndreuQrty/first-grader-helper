import bridge from '@vkontakte/vk-bridge'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export interface AuthBootstrap {
  csrf_token: string
  mode: 'vk' | 'development'
  app_variant: 'public' | 'admin'
}

const APP_VARIANT = import.meta.env.VITE_APP_VARIANT === 'admin' ? 'admin' : 'public'
let platformAvatarUrl: string | null = null

export function getPlatformAvatarUrl(): string | null {
  return platformAvatarUrl
}

function isVkLaunch(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.has('vk_app_id') && params.has('sign')
}

async function postAuth(
  path: string,
  payload: object,
  transport: typeof fetch,
): Promise<AuthBootstrap> {
  const response = await transport(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Authentication failed with status ${response.status}`)
  }
  return response.json() as Promise<AuthBootstrap>
}

export async function bootstrapPlatform(
  transport: typeof fetch = fetch,
  search: string = window.location.search,
): Promise<AuthBootstrap> {
  if (isVkLaunch(search)) {
    await bridge.send('VKWebAppInit')
    let profile:
      | { id: number; first_name: string; last_name: string }
      | undefined
    try {
      const user = await bridge.send('VKWebAppGetUserInfo')
      platformAvatarUrl = user.photo_200 || user.photo_100 || null
      profile = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
      }
    } catch {
      // A denied profile request must not block signed VK authentication.
      platformAvatarUrl = null
    }
    return postAuth('/auth/vk', { launch_params: search, profile }, transport)
  }

  // Browser mode is intentionally a separate backend endpoint that disappears
  // in production; it never pretends that VK verified the current user.
  platformAvatarUrl = null
  return postAuth(
    '/auth/dev',
    {
      vk_user_id: 1,
      display_name: 'Локальный разработчик',
      first_name: 'Локальный',
      last_name: 'разработчик',
      profile: APP_VARIANT === 'admin' ? 'superadmin' : 'student',
      app_variant: APP_VARIANT,
    },
    transport,
  )
}

export function persistCsrf(auth: AuthBootstrap): void {
  localStorage.setItem('ipmkn.csrf', auth.csrf_token)
  sessionStorage.removeItem('ipmkn.csrf')
}
