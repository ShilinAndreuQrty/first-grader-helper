import { Icon24MenuOutline } from '@vkontakte/icons'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  PanelHeader,
  PanelHeaderBack,
  PanelHeaderButton,
} from '@vkontakte/vkui'

import { PANEL_PATHS } from '../router'

interface AppPanelHeaderProps {
  children: string
  backToHome?: boolean
}

export function AppPanelHeader({
  children,
  backToHome = false,
}: AppPanelHeaderProps) {
  const navigator = useRouteNavigator()

  return (
    <PanelHeader
      before={
        backToHome ? (
          <PanelHeaderBack
            aria-label="Назад на главную"
            onClick={() => void navigator.push(PANEL_PATHS.home)}
          />
        ) : undefined
      }
      after={
        <PanelHeaderButton
          aria-label="Открыть раздел «Ещё»"
          onClick={() => void navigator.push(PANEL_PATHS.more)}
        >
          <Icon24MenuOutline />
        </PanelHeaderButton>
      }
    >
      {children}
    </PanelHeader>
  )
}
