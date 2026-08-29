import React, { ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { bootstrapPlatform, persistCsrf } from './platform'

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

function renderApplication(application: ReactNode) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        {application}
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

export async function bootstrapApplication(application: ReactNode) {
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
    // The UI renders an explicit API error while authentication is unavailable.
  } finally {
    clearTimeout(timeoutId)
    renderApplication(application)
  }
}
