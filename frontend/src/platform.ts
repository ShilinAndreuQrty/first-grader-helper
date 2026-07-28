import bridge from '@vkontakte/vk-bridge'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export interface AuthBootstrap {
  csrf_token: string
  mode: 'vk' | 'development'
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
    return postAuth('/auth/vk', { launch_params: search }, transport)
  }

  // Browser mode is intentionally a separate backend endpoint that disappears
  // in production; it never pretends that VK verified the current user.
  return postAuth(
    '/auth/dev',
    {
      vk_user_id: 1,
      display_name: 'Локальный разработчик',
      profile: 'superadmin',
    },
    transport,
  )
}

export function persistCsrf(auth: AuthBootstrap): void {
  sessionStorage.setItem('ipmkn.csrf', auth.csrf_token)
}
