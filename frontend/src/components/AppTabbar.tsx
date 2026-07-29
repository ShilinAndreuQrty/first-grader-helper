import {
  Icon20CalendarOutline,
  Icon20EducationOutline,
  Icon20HomeOutline,
  Icon20MessageOutline,
  Icon20PlaceOutline,
} from '@vkontakte/icons'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import { Tabbar, TabbarItem } from '@vkontakte/vkui'

import { PANEL_PATHS } from '../router'

interface AppTabbarProps {
  activePanel: string
}

const items = [
  { id: 'home', label: 'Главная', icon: <Icon20HomeOutline /> },
  { id: 'assistant', label: 'Помощник', icon: <Icon20MessageOutline /> },
  { id: 'schedule', label: 'Расписание', icon: <Icon20EducationOutline /> },
  { id: 'map', label: 'Карта', icon: <Icon20PlaceOutline /> },
  { id: 'events', label: 'События', icon: <Icon20CalendarOutline /> },
] as const

export function AppTabbar({ activePanel }: AppTabbarProps) {
  const navigator = useRouteNavigator()

  return (
    <Tabbar>
      {items.map((item) => (
        <TabbarItem
          key={item.id}
          selected={activePanel === item.id}
          label={item.label}
          onClick={() => void navigator.push(PANEL_PATHS[item.id])}
        >
          {item.icon}
        </TabbarItem>
      ))}
    </Tabbar>
  )
}
