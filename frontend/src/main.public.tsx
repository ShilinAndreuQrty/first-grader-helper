import '@vkontakte/vkui/dist/vkui.css'
import './styles.css'

import { RouterProvider } from '@vkontakte/vk-mini-apps-router'

import { App } from './App'
import { bootstrapApplication } from './bootstrap'
import { router } from './router'
import { appColorScheme, applyAppTheme } from './theme'

applyAppTheme(appColorScheme)
void bootstrapApplication(
  <RouterProvider router={router}>
    <App />
  </RouterProvider>,
)
