import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import bridge from '@vkontakte/vk-bridge'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  Group,
  Header,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  SimpleCell,
  Spinner,
  Switch,
} from '@vkontakte/vkui'
import { useState } from 'react'

import {
  NotificationPreferences,
  getNotificationPreferences,
  getPublicConfig,
  updateNotificationPreferences,
} from '../api/notifications'
import { PANEL_PATHS } from '../router'

export function SettingsPanel({ id = 'settings' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const queryClient = useQueryClient()
  const [permissionFeedback, setPermissionFeedback] = useState<{
    title: string
    subtitle: string
  } | null>(null)
  const [requestingPermission, setRequestingPermission] = useState<
    'notifications' | 'community' | null
  >(null)
  const config = useQuery({ queryKey: ['public-config'], queryFn: getPublicConfig })
  const preferences = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  })
  const save = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (value) =>
      queryClient.setQueryData(['notification-preferences'], value),
  })

  const update = (
    key: keyof NotificationPreferences,
    value: boolean | number,
  ) => {
    if (!preferences.data) return
    save.mutate({ ...preferences.data, [key]: value })
  }

  const allowVkNotifications = async () => {
    if (!bridge.isEmbedded()) {
      setPermissionFeedback({
        title: 'Откройте приложение внутри VK',
        subtitle: 'Системное разрешение на уведомления доступно только в мобильном приложении или на сайте VK.',
      })
      return
    }
    setRequestingPermission('notifications')
    try {
      const result = await bridge.send('VKWebAppAllowNotifications')
      if (!result.result) throw new Error('Permission was not granted')
      update('vk_notifications_enabled', true)
      setPermissionFeedback({
        title: 'Уведомления VK разрешены',
        subtitle: 'Вы сможете изменить это разрешение в настройках VK.',
      })
    } catch {
      update('vk_notifications_enabled', false)
      setPermissionFeedback({
        title: 'Разрешение не получено',
        subtitle: 'Проверьте настройки уведомлений VK и попробуйте ещё раз.',
      })
    } finally {
      setRequestingPermission(null)
    }
  }

  const allowCommunityMessages = async () => {
    if (!bridge.isEmbedded()) {
      setPermissionFeedback({
        title: 'Откройте приложение внутри VK',
        subtitle: 'Разрешение на сообщения сообщества запрашивается через VK.',
      })
      return
    }
    if (!config.data?.vk_community_id) {
      setPermissionFeedback({
        title: 'Сообщество пока не подключено',
        subtitle: 'Нужно указать VK_COMMUNITY_ID на сервере приложения.',
      })
      return
    }
    setRequestingPermission('community')
    try {
      const result = await bridge.send('VKWebAppAllowMessagesFromGroup', {
        group_id: config.data.vk_community_id,
      })
      if (!result.result) throw new Error('Permission was not granted')
      update('community_messages_enabled', true)
      setPermissionFeedback({
        title: 'Сообщения профбюро разрешены',
        subtitle: 'Профбюро ИПМКН ТулГУ сможет отправлять вам сообщения после включения рассылки на сервере.',
      })
    } catch {
      update('community_messages_enabled', false)
      setPermissionFeedback({
        title: 'Разрешение не получено',
        subtitle: 'Проверьте сообщения сообщества в настройках VK и попробуйте ещё раз.',
      })
    } finally {
      setRequestingPermission(null)
    }
  }

  return (
    <Panel id={id}>
      <PanelHeader
        before={
          <PanelHeaderBack
            aria-label="Назад"
            onClick={() => void navigator.push(PANEL_PATHS.more)}
          />
        }
      >
        Настройки
      </PanelHeader>
      {preferences.isLoading && <Spinner size="m" />}
      {preferences.isError && (
        <Group>
          <Banner
            title="Настройки недоступны"
            subtitle="Авторизуйтесь заново и попробуйте ещё раз."
          />
        </Group>
      )}
      {preferences.data && (
        <>
          <Group header={<Header>О чём напоминать</Header>}>
            <SimpleCell
              after={
                <Switch
                  aria-label="Профсоюзные собрания"
                  checked={preferences.data.union_meetings}
                  onChange={(event) =>
                    update('union_meetings', event.target.checked)
                  }
                />
              }
            >
              Профсоюзные собрания
            </SimpleCell>
            <SimpleCell
              after={
                <Switch
                  aria-label="Выбранные события"
                  checked={preferences.data.selected_events}
                  onChange={(event) =>
                    update('selected_events', event.target.checked)
                  }
                />
              }
            >
              Выбранные события
            </SimpleCell>
            <SimpleCell
              after={
                <Switch
                  aria-label="Важные объявления"
                  checked={preferences.data.announcements}
                  onChange={(event) =>
                    update('announcements', event.target.checked)
                  }
                />
              }
            >
              Важные объявления
            </SimpleCell>
          </Group>

          <Group header={<Header>Каналы</Header>}>
            <SimpleCell
              subtitle="Работает без разрешений VK"
              after={
                <Switch
                  aria-label="Внутри приложения"
                  checked={preferences.data.in_app_enabled}
                  onChange={(event) =>
                    update('in_app_enabled', event.target.checked)
                  }
                />
              }
            >
              Внутри приложения
            </SimpleCell>
            <SimpleCell
              subtitle="VK отдельно запросит разрешение"
              after={
                <Button
                  size="s"
                  mode="secondary"
                  loading={requestingPermission === 'notifications'}
                  disabled={preferences.data.vk_notifications_enabled}
                  onClick={() => void allowVkNotifications()}
                >
                  {preferences.data.vk_notifications_enabled
                    ? 'Разрешено'
                    : 'Разрешить'}
                </Button>
              }
            >
              Уведомления VK
            </SimpleCell>
            <SimpleCell
              subtitle="Профбюро ИПМКН ТулГУ, только после вашего согласия"
              after={
                <Button
                  size="s"
                  mode="secondary"
                  loading={requestingPermission === 'community'}
                  disabled={preferences.data.community_messages_enabled}
                  onClick={() => void allowCommunityMessages()}
                >
                  {preferences.data.community_messages_enabled
                    ? 'Разрешено'
                    : 'Разрешить'}
                </Button>
              }
            >
              Сообщения сообщества
            </SimpleCell>
          </Group>
          {permissionFeedback && (
            <Group>
              <Banner
                title={permissionFeedback.title}
                subtitle={permissionFeedback.subtitle}
              />
            </Group>
          )}
          {!config.data?.notifications_enabled && (
            <Group>
              <Banner
                title="Внешняя отправка пока выключена"
                subtitle="Настройки согласия сохраняются, но сообщения начнут отправляться только после включения серверного feature flag."
              />
            </Group>
          )}
        </>
      )}
    </Panel>
  )
}

