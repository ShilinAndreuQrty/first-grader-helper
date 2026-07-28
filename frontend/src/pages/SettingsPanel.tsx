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
    try {
      await bridge.send('VKWebAppAllowNotifications')
      update('vk_notifications_enabled', true)
    } catch {
      update('vk_notifications_enabled', false)
    }
  }

  const allowCommunityMessages = async () => {
    if (!config.data?.vk_community_id) return
    try {
      await bridge.send('VKWebAppAllowMessagesFromGroup', {
        group_id: config.data.vk_community_id,
      })
      update('community_messages_enabled', true)
    } catch {
      update('community_messages_enabled', false)
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
                  disabled={!bridge.isEmbedded()}
                  onClick={() => void allowVkNotifications()}
                >
                  Разрешить
                </Button>
              }
            >
              Уведомления VK
            </SimpleCell>
            <SimpleCell
              subtitle="Сообщество Dev Zone, только после вашего согласия"
              after={
                <Button
                  size="s"
                  mode="secondary"
                  disabled={
                    !bridge.isEmbedded() || !config.data?.vk_community_id
                  }
                  onClick={() => void allowCommunityMessages()}
                >
                  Разрешить
                </Button>
              }
            >
              Сообщения сообщества
            </SimpleCell>
          </Group>
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

