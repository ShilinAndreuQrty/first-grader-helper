import { Icon24MenuOutline } from '@vkontakte/icons'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  PanelHeader,
  PanelHeaderBack,
  PanelHeaderButton,
} from '@vkontakte/vkui'
import type { ReactNode } from 'react'

import { PANEL_PATHS } from '../router'
import { getCurrentRootPath, setMoreReturnPath } from '../navigation'

interface AppPanelHeaderProps {
  children: string
  backToHome?: boolean
  beforeMenu?: ReactNode
}

export function AppPanelHeader({
  children,
  backToHome = false,
  beforeMenu,
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
        <>
          {beforeMenu}
          <PanelHeaderButton
            aria-label="Открыть раздел «Ещё»"
            onClick={() => {
              setMoreReturnPath(getCurrentRootPath())
              void navigator.push(PANEL_PATHS.more)
            }}
          >
            <Icon24MenuOutline />
          </PanelHeaderButton>
        </>
      }
    >
      {children}
    </PanelHeader>
  )
}
