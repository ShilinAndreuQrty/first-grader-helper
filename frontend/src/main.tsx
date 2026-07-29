import '@vkontakte/vkui/dist/vkui.css'
import './styles.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@vkontakte/vk-mini-apps-router'

import { App } from './App'
import { bootstrapPlatform, persistCsrf } from './platform'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8_000

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={router}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </RouterProvider>
    </React.StrictMode>,
  )
}

async function bootstrapApp() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    const auth = await Promise.race([
      bootstrapPlatform(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Authentication bootstrap timed out')),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
        )
      }),
    ])
    persistCsrf(auth)
  } catch {
    // Public screens still provide a useful degraded state if auth is down.
  } finally {
    clearTimeout(timeoutId)
    renderApp()
  }
}

void bootstrapApp()
