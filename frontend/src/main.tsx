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

void bootstrapPlatform()
  .then(persistCsrf)
  .catch(() => {
    // The app still renders useful fallback screens if auth or VK is unavailable.
  })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </RouterProvider>
  </React.StrictMode>,
)
