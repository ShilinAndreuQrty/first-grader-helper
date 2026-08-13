import { PANEL_PATHS } from './router'

const MORE_RETURN_PATH_KEY = 'ipmkn.moreReturnPath'
const ADMIN_RETURN_PATH_KEY = 'ipmkn.adminReturnPath'

const ROOT_PATHS = new Set<string>([
  PANEL_PATHS.home,
  PANEL_PATHS.assistant,
  PANEL_PATHS.schedule,
  PANEL_PATHS.map,
  PANEL_PATHS.events,
])

function readPath(key: string, fallback: string): string {
  const path = sessionStorage.getItem(key)
  return path && ROOT_PATHS.has(path) ? path : fallback
}

export function getCurrentRootPath(): string {
  const path = window.location.hash.replace(/^#/, '') || PANEL_PATHS.home
  return ROOT_PATHS.has(path) ? path : PANEL_PATHS.home
}

export function setMoreReturnPath(path: string): void {
  sessionStorage.setItem(
    MORE_RETURN_PATH_KEY,
    ROOT_PATHS.has(path) ? path : PANEL_PATHS.home,
  )
}

export function getMoreReturnPath(): string {
  return readPath(MORE_RETURN_PATH_KEY, PANEL_PATHS.home)
}

export function setAdminReturnPath(path: string): void {
  const returnPath = path === PANEL_PATHS.more || ROOT_PATHS.has(path)
    ? path
    : PANEL_PATHS.more
  sessionStorage.setItem(ADMIN_RETURN_PATH_KEY, returnPath)
}

export function takeAdminReturnPath(): string {
  const path = sessionStorage.getItem(ADMIN_RETURN_PATH_KEY)
  sessionStorage.removeItem(ADMIN_RETURN_PATH_KEY)
  return path === PANEL_PATHS.more || (path !== null && ROOT_PATHS.has(path))
    ? path
    : PANEL_PATHS.more
}
