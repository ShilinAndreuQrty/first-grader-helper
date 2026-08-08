import { Icon20ChevronRightOutline } from '@vkontakte/icons'
import { useQuery } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  Group,
  Header,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Placeholder,
  SimpleCell,
  Spinner,
} from '@vkontakte/vkui'
import { useMemo } from 'react'

import { getResources } from '../api/students'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'
import { VkAvatar } from '../components/VkAvatar'

function resourceInitials(title: string): string {
  return (title.match(/[\p{L}\p{N}]+/gu) ?? [])
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function ResourcesPanel({ id = 'resources' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const resources = useQuery({ queryKey: ['resources'], queryFn: getResources })
  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          (resources.data ?? []).map((resource) => [
            resource.category_slug,
            resource.category,
          ]),
        ),
      ),
    [resources.data],
  )

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
        Полезные ссылки
      </PanelHeader>
      {resources.isLoading && <Spinner size="m" />}
      {resources.isError && (
        <Group>
          <Banner
            title="Каталог временно недоступен"
            subtitle="Проверьте соединение и откройте раздел ещё раз."
            actions={
              <Button onClick={() => void resources.refetch()}>
                Повторить
              </Button>
            }
          />
        </Group>
      )}
      {resources.isSuccess && resources.data.length === 0 && (
        <Placeholder>Проверенных ссылок пока нет.</Placeholder>
      )}
      {categories.map(([categorySlug, categoryTitle]) => (
        <Group key={categorySlug} header={<Header>{categoryTitle}</Header>}>
          {resources.data
            ?.filter((resource) => resource.category_slug === categorySlug)
            .map((resource) => (
              <SimpleCell
                key={resource.id}
                multiline
                before={
                  <VkAvatar
                    size={44}
                    vkUrl={resource.url}
                    initials={resourceInitials(resource.title)}
                    className={`resource-avatar resource-avatar--${resource.icon}`}
                  />
                }
                after={<Icon20ChevronRightOutline />}
                subtitle={`${resource.description} · ${
                  resource.source_kind === 'official'
                    ? 'Официальный источник'
                    : 'Студенческий источник'
                }`}
                onClick={() => void openExternalUrl(resource.url)}
              >
                {resource.title}
              </SimpleCell>
            ))}
        </Group>
      ))}
    </Panel>
  )
}
