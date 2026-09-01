import {
  Icon20CalendarOutline,
  Icon20MessageOutline,
  Icon20UserOutline,
} from '@vkontakte/icons'
import {
  AdaptivityProvider,
  AppRoot,
  ConfigProvider,
  Epic,
  Tabbar,
  TabbarItem,
  View,
} from '@vkontakte/vkui'
import { useState } from 'react'

import {
  AdminEventsPanel,
  AdminFeedbackPanel,
  AdminUsersPanel,
} from './pages/AdminPanel'
import { useAppColorScheme } from './theme'

type AdminSection = 'events' | 'users' | 'feedback'

const sections = [
  { id: 'events', label: 'События', icon: <Icon20CalendarOutline /> },
  { id: 'users', label: 'Пользователи', icon: <Icon20UserOutline /> },
  { id: 'feedback', label: 'Обратная связь', icon: <Icon20MessageOutline /> },
] as const

export function AdminApp() {
  const [activeSection, setActiveSection] = useState<AdminSection>('events')
  const colorScheme = useAppColorScheme()

  return (
    <ConfigProvider colorScheme={colorScheme}>
      <AdaptivityProvider>
        <AppRoot>
          <Epic
            activeStory="admin"
            tabbar={
              <Tabbar>
                {sections.map((section) => (
                  <TabbarItem
                    key={section.id}
                    selected={activeSection === section.id}
                    label={section.label}
                    onClick={() => setActiveSection(section.id)}
                  >
                    {section.icon}
                  </TabbarItem>
                ))}
              </Tabbar>
            }
          >
            <View id="admin" activePanel={activeSection}>
              <AdminEventsPanel id="events" />
              <AdminUsersPanel id="users" />
              <AdminFeedbackPanel id="feedback" />
            </View>
          </Epic>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}
