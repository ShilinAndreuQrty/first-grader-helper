import '@vkontakte/vkui/dist/vkui.css'
import './styles.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from './App'
import { bootstrapPlatform, persistCsrf } from './platform'

void bootstrapPlatform()
  .then(persistCsrf)
  .catch(() => {
    // The app still renders useful fallback screens if auth or VK is unavailable.
  })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
