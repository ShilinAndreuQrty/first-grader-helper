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
  PanelHeaderBack,
  SimpleCell,
} from '@vkontakte/vkui'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import { useEffect } from 'react'

import { getCurrentUser } from '../api/auth'
import {
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
  const profburo = resources.data?.find(
    (resource) => resource.slug === 'profburo-ipmkn',
  )
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
  const makePrimary = useMutation({
    mutationFn: (groupId: string) => saveGroup(groupId, true),
    onSuccess: refreshGroups,
  })
  const deleteGroup = useMutation({
    mutationFn: removeGroup,
    onSuccess: refreshGroups,
  })

  useEffect(() => {
    const target = sessionStorage.getItem('ipmkn.moreTarget')
    if (!target) return
    sessionStorage.removeItem('ipmkn.moreTarget')
    requestAnimationFrame(() =>
      document.getElementById(target)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      }),
    )
  }, [])

  return (
    <Panel id={id}>
      <PanelHeader
        before={
          <PanelHeaderBack
            aria-label="Назад на главную"
            onClick={() => void navigator.push(PANEL_PATHS.home)}
          />
        }
      >
        Ещё
      </PanelHeader>
      <Group header={<Header>Профиль</Header>}>
        {currentUser.data && (
          <SimpleCell
            before={
              <Avatar
                size={48}
                initials={
                  currentUser.data.first_name.slice(0, 1) ||
                  currentUser.data.display_name.slice(0, 1) ||
                  'VK'
                }
              />
            }
            subtitle={`VK ID ${currentUser.data.vk_user_id}${
              primaryGroup ? ` · группа ${primaryGroup.code}` : ' · группа не выбрана'
            }`}
            onClick={() => void openExternalUrl(currentUser.data.profile_url)}
          >
            {currentUser.data.display_name || 'Пользователь VK'}
          </SimpleCell>
        )}
      </Group>
      <Group header={<Header>Мои группы</Header>}>
        <SimpleCell
          subtitle="Шесть цифр или шесть цифр и двухзначный суффикс"
          onClick={() => void navigator.push(PANEL_PATHS.schedule)}
        >
          Найти и сохранить группу
        </SimpleCell>
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

      <Group id="my-tutor" header={<Header>Мой тьютор</Header>}>
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
                disabled={!profburo}
                onClick={() =>
                  profburo && void openExternalUrl(profburo.url)
                }
              >
                {profburo ? 'Написать профбюро' : 'Контакт не настроен'}
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
          onClick={() => {
            if (!primaryGroup) {
              void navigator.push(PANEL_PATHS.schedule)
              return
            }
            document
              .getElementById('my-tutor')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
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
          onClick={() => void navigator.push(PANEL_PATHS.resources)}
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
