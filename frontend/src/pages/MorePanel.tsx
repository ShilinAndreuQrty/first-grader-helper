import {
  Icon28BookSpreadOutline,
  Icon28HelpCircleOutline,
  Icon28PlaceOutline,
  Icon28SettingsOutline,
  Icon28Users3Outline,
} from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Banner,
  Button,
  ButtonGroup,
  Group,
  Header,
  Panel,
  PanelHeader,
  Search,
  SimpleCell,
  Spinner,
} from '@vkontakte/vkui'
import { useState } from 'react'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'

import { getCurrentUser } from '../api/auth'
import {
  findGroups,
  getMyGroups,
  getResources,
  getTutors,
  removeGroup,
  saveGroup,
} from '../api/students'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'

export function MorePanel({ id = 'more' }: { id?: string }) {
  const queryClient = useQueryClient()
  const navigator = useRouteNavigator()
  const [groupQuery, setGroupQuery] = useState('')
  const groups = useQuery({
    queryKey: ['groups', groupQuery],
    queryFn: () => findGroups(groupQuery),
    enabled: groupQuery.trim().length > 0,
  })
  const saved = useQuery({ queryKey: ['my-groups'], queryFn: getMyGroups })
  const primaryGroup = saved.data?.find((group) => group.is_primary)
  const tutors = useQuery({
    queryKey: ['tutors', primaryGroup?.id],
    queryFn: () => getTutors(primaryGroup!.id),
    enabled: Boolean(primaryGroup),
  })
  const resources = useQuery({
    queryKey: ['resources'],
    queryFn: getResources,
  })
  const currentUser = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
    retry: false,
  })
  const isEditor = currentUser.data?.roles.some((role) =>
    ['superadmin', 'content_editor', 'events_editor'].includes(role),
  )
  const refreshGroups = () =>
    queryClient.invalidateQueries({ queryKey: ['my-groups'] })
  const addGroup = useMutation({
    mutationFn: (groupId: string) => saveGroup(groupId),
    onSuccess: refreshGroups,
  })
  const makePrimary = useMutation({
    mutationFn: (groupId: string) => saveGroup(groupId, true),
    onSuccess: refreshGroups,
  })
  const deleteGroup = useMutation({
    mutationFn: removeGroup,
    onSuccess: refreshGroups,
  })

  return (
    <Panel id={id}>
      <PanelHeader>Ещё</PanelHeader>
      <Group header={<Header>Мои группы</Header>}>
        <Search
          value={groupQuery}
          placeholder="Например, ИВТ-101"
          onChange={(event) => setGroupQuery(event.target.value)}
        />
        {groups.isFetching && <Spinner size="s" />}
        {groupQuery && groups.data?.length === 0 && (
          <Banner
            title="Группа не найдена"
            subtitle="Проверьте номер. Мы не подставляем похожую группу автоматически."
          />
        )}
        {groups.data?.map((group) => (
          <SimpleCell
            key={group.id}
            subtitle={group.academic_year || 'Учебный год не указан'}
            after={
              <Button
                size="s"
                loading={addGroup.isPending}
                onClick={() => addGroup.mutate(group.id)}
              >
                Сохранить
              </Button>
            }
          >
            {group.code}
          </SimpleCell>
        ))}
        {saved.data?.map((group) => (
          <SimpleCell
            key={group.id}
            indicator={group.is_primary ? 'Основная' : undefined}
            subtitle={group.academic_year || 'Сохранённая группа'}
            after={
              <ButtonGroup mode="horizontal" gap="s">
                {!group.is_primary && (
                  <Button
                    size="s"
                    mode="secondary"
                    onClick={() => makePrimary.mutate(group.id)}
                  >
                    Выбрать
                  </Button>
                )}
                <Button
                  size="s"
                  mode="tertiary"
                  onClick={() => deleteGroup.mutate(group.id)}
                >
                  Удалить
                </Button>
              </ButtonGroup>
            }
          >
            {group.code}
          </SimpleCell>
        ))}
      </Group>

      <Group header={<Header>Мой тьютор</Header>}>
        {!primaryGroup && (
          <Banner
            title="Укажите основную группу"
            subtitle="После этого приложение найдёт назначенного тьютора."
          />
        )}
        {primaryGroup && tutors.data?.length === 0 && (
          <Banner
            title="Тьютор пока не указан"
            subtitle="Сообщите об этом профбюро ИПМКН — соответствие групп обновляется каждый учебный год."
            actions={
              <Button
                onClick={() =>
                  void openExternalUrl('https://vk.ru/profburo_ipmkn_tsu')
                }
              >
                Написать профбюро
              </Button>
            }
          />
        )}
        {tutors.data?.map((tutor) => (
          <SimpleCell
            key={tutor.id}
            before={
              <Avatar
                size={48}
                src={tutor.photo_url ?? undefined}
                initials={tutor.full_name.slice(0, 1)}
              />
            }
            subtitle={tutor.description || `Тьютор группы ${primaryGroup?.code}`}
            onClick={() => void openExternalUrl(tutor.vk_url)}
          >
            {tutor.full_name}
          </SimpleCell>
        ))}
      </Group>

      <Group header={<Header>Справочники</Header>}>
        <SimpleCell
          before={<Icon28Users3Outline />}
          subtitle="Контакты наставника вашей группы"
        >
          Мой тьютор
        </SimpleCell>
        <SimpleCell
          before={<Icon28PlaceOutline />}
          subtitle="Корпуса, аудитории и маршруты"
          onClick={() => void navigator.push(PANEL_PATHS.map)}
        >
          Карта
        </SimpleCell>
        <SimpleCell
          before={<Icon28BookSpreadOutline />}
          subtitle="Личный кабинет, расписание, документы"
        >
          Полезные ссылки
        </SimpleCell>
        <SimpleCell
          before={<Icon28HelpCircleOutline />}
          subtitle="О проекте и обратная связь"
          onClick={() => void navigator.push(PANEL_PATHS.about)}
        >
          Помощь
        </SimpleCell>
        <SimpleCell
          before={<Icon28SettingsOutline />}
          subtitle="Группы, напоминания и приватность"
          onClick={() => void navigator.push(PANEL_PATHS.settings)}
        >
          Настройки
        </SimpleCell>
        <SimpleCell
          subtitle="Какие данные сохраняются"
          onClick={() => void navigator.push(PANEL_PATHS.privacy)}
        >
          Конфиденциальность
        </SimpleCell>
      </Group>

      <Group header={<Header>Полезные ссылки</Header>}>
        {resources.data?.map((resource) => (
          <SimpleCell
            key={resource.id}
            before={<Icon28BookSpreadOutline />}
            subtitle={resource.category}
            onClick={() => void openExternalUrl(resource.url)}
          >
            {resource.title}
          </SimpleCell>
        ))}
        {resources.isError && (
          <Banner
            title="Ссылки временно недоступны"
            subtitle="Попробуйте открыть раздел позднее."
          />
        )}
      </Group>
      {isEditor && (
        <Group header={<Header>Для команды</Header>}>
          <SimpleCell
            subtitle="Контент, события и аудит"
            onClick={() => void navigator.push(PANEL_PATHS.admin)}
          >
            Админ-панель
          </SimpleCell>
        </Group>
      )}
    </Panel>
  )
}
