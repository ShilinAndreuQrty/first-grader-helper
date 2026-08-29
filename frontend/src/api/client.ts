import { bootstrapPlatform, persistCsrf } from '../platform'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

let reauthentication: Promise<void> | null = null

async function restoreSession(): Promise<void> {
  if (!reauthentication) {
    reauthentication = bootstrapPlatform()
      .then(persistCsrf)
      .finally(() => {
        reauthentication = null
      })
  }
  return reauthentication
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const execute = () => {
    const headers = new Headers(init.headers)
    if (init.body) headers.set('Content-Type', 'application/json')
    // Auth cookies are shared between tabs, so the matching CSRF token must be
    // shared too. Otherwise opening a second tab invalidates writes in the first.
    const csrf =
      localStorage.getItem('ipmkn.csrf') ??
      sessionStorage.getItem('ipmkn.csrf')
    if (csrf && init.method && init.method !== 'GET') {
      headers.set('X-CSRF-Token', csrf)
    }
    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    })
  }

  let response = await execute()
  if (response.status === 401) {
    try {
      await restoreSession()
      response = await execute()
    } catch {
      // Preserve the original API error when the platform session cannot recover.
    }
  }
  if (!response.ok) {
    let message = 'Сервис временно недоступен'
    try {
      const payload = (await response.json()) as { detail?: unknown }
      if (typeof payload.detail === 'string') message = payload.detail
    } catch {
      // Some upstream failures return an empty or non-JSON body.
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}
