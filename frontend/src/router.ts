import {
  RoutesConfig,
  createHashRouter,
  createPanel,
  createView,
} from '@vkontakte/vk-mini-apps-router'

export const PANEL_PATHS = {
  home: '/',
  schedule: '/schedule',
  events: '/events',
  assistant: '/assistant',
  more: '/more',
  admin: '/admin',
  map: '/map',
  settings: '/settings',
} as const

const routes = RoutesConfig.create([
  createView('main', [
    createPanel('home', PANEL_PATHS.home),
    createPanel('schedule', PANEL_PATHS.schedule),
    createPanel('events', PANEL_PATHS.events),
    createPanel('assistant', PANEL_PATHS.assistant),
    createPanel('more', PANEL_PATHS.more),
    createPanel('admin', PANEL_PATHS.admin),
    createPanel('map', PANEL_PATHS.map),
    createPanel('settings', PANEL_PATHS.settings),
  ]),
])

// Hash routing keeps VK launch parameters in the query string and makes direct
// links work without special rewrites on the static frontend server.
export const router = createHashRouter(routes.getRoutes())
