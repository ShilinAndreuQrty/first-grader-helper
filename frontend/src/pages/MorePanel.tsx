import {
  Icon28BookSpreadOutline,
  Icon28HelpCircleOutline,
  Icon28PrivacyOutline,
  Icon28SettingsOutline,
} from '@vkontakte/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banner,
  Button,
  ButtonGroup,
  Group,
  Header,
  Input,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  SimpleCell,
} from '@vkontakte/vkui'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import { useEffect, useState } from 'react'

import { getCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import { saveGroupByCode } from '../api/schedule'
import {
  getMyGroups,
  getResources,
  getTutors,
} from '../api/students'
import {
  GROUP_CODE_HINT,
  isValidGroupCode,
  normalizeGroupCode,
} from '../groupCode'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'
import { getMoreReturnPath, setAdminReturnPath } from '../navigation'
import { VkAvatar } from '../components/VkAvatar'

export function MorePanel({ id = 'more' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const queryClient = useQueryClient()
  const [editingPrimary, setEditingPrimary] = useState(false)
  const [groupCode, setGroupCode] = useState('')
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
  const normalizedGroupCode = normalizeGroupCode(groupCode)
  const changePrimary = useMutation({
    mutationFn: () => saveGroupByCode(normalizedGroupCode, true),
    onSuccess: () => {
      setEditingPrimary(false)
      setGroupCode('')
      void queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] })
    },
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
            aria-label="Назад"
            onClick={() => void navigator.push(getMoreReturnPath())}
          />
        }
      >
        Ещё
      </PanelHeader>
      <Group header={<Header>Профиль</Header>}>
        {currentUser.data && (
          <SimpleCell
            before={
              <VkAvatar
                size={48}
                vkUrl={currentUser.data.profile_url}
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
      <Group header={<Header>Моя группа</Header>}>
        {primaryGroup ? (
          <SimpleCell
            subtitle={primaryGroup.academic_year || 'Основная учебная группа'}
            after={
              <Button
                size="s"
                mode="secondary"
                onClick={() => {
                  setGroupCode(primaryGroup.code)
                  setEditingPrimary((value) => !value)
                }}
              >
                Изменить
              </Button>
            }
          >
            {primaryGroup.code}
          </SimpleCell>
        ) : (
          <SimpleCell
            subtitle="Выберите группу, чтобы видеть расписание и тьютора"
            onClick={() => void navigator.push(PANEL_PATHS.schedule)}
          >
            Выбрать основную группу
          </SimpleCell>
        )}
        {editingPrimary && (
          <form
            className="more-primary-group-editor"
            onSubmit={(event) => {
              event.preventDefault()
              if (isValidGroupCode(normalizedGroupCode)) changePrimary.mutate()
            }}
          >
            <Input
              aria-label="Новый номер своей группы"
              value={groupCode}
              placeholder="Например, 222231"
              inputMode="numeric"
              status={
                groupCode && !isValidGroupCode(normalizedGroupCode)
                  ? 'error'
                  : 'default'
              }
              onChange={(event) => setGroupCode(event.target.value)}
            />
            {groupCode && !isValidGroupCode(normalizedGroupCode) && (
              <Banner title="Проверьте формат номера" subtitle={GROUP_CODE_HINT} />
            )}
            <ButtonGroup mode="horizontal" gap="s" stretched>
              <Button
                type="submit"
                loading={changePrimary.isPending}
                disabled={!isValidGroupCode(normalizedGroupCode)}
              >
                Сохранить
              </Button>
              <Button
                type="button"
                mode="secondary"
                onClick={() => {
                  setEditingPrimary(false)
                  setGroupCode('')
                }}
              >
                Отмена
              </Button>
            </ButtonGroup>
            {changePrimary.error && (
              <Banner
                title="Не удалось изменить группу"
                subtitle={
                  changePrimary.error instanceof ApiError
                    ? changePrimary.error.message
                    : 'Попробуйте ещё раз.'
                }
              />
            )}
          </form>
        )}
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
              <VkAvatar
                size={48}
                vkUrl={tutor.vk_url}
                preferredSrc={tutor.photo_url}
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

      <Group header={<Header>Приложение</Header>}>
        <SimpleCell
          before={<Icon28SettingsOutline />}
          subtitle="Основная группа, напоминания и приватность"
          onClick={() => void navigator.push(PANEL_PATHS.settings)}
        >
          Настройки
        </SimpleCell>
        <SimpleCell
          before={<Icon28BookSpreadOutline />}
          subtitle="Личный кабинет, расписание, документы"
          onClick={() => void navigator.push(PANEL_PATHS.resources)}
        >
          Полезные ссылки
        </SimpleCell>
        <SimpleCell
          before={<Icon28PrivacyOutline />}
          subtitle="Какие данные сохраняются"
          onClick={() => void navigator.push(PANEL_PATHS.privacy)}
        >
          Конфиденциальность
        </SimpleCell>
        <SimpleCell
          before={<Icon28HelpCircleOutline />}
          subtitle="Информация о нас и обратная связь"
          onClick={() => void navigator.push(PANEL_PATHS.about)}
        >
          О проекте
        </SimpleCell>
      </Group>

      {isEditor && (
        <Group header={<Header>Для команды</Header>}>
          <SimpleCell
            subtitle="Контент, события и аудит"
            onClick={() => {
              setAdminReturnPath(PANEL_PATHS.more)
              void navigator.push(PANEL_PATHS.admin)
            }}
          >
            Админ-панель
          </SimpleCell>
        </Group>
      )}
    </Panel>
  )
}
