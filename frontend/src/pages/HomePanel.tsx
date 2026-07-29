import {
  Icon28InfoCircleOutline,
  Icon28LinkOutline,
  Icon28PlaceOutline,
  Icon28Users3Outline,
} from '@vkontakte/icons'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Button,
  Div,
  Group,
  Header,
  Panel,
  SimpleCell,
  Text,
  Title,
} from '@vkontakte/vkui'
import { useQuery } from '@tanstack/react-query'

import { getMyGroups } from '../api/students'
import { getOnboarding } from '../api/onboarding'
import { setMapTargetRoom } from '../campusLocation'
import { AppPanelHeader } from '../components/AppPanelHeader'
import { PANEL_PATHS } from '../router'

export function HomePanel({ id = 'home' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const groups = useQuery({ queryKey: ['my-groups'], queryFn: getMyGroups })
  const onboarding = useQuery({
    queryKey: ['onboarding'],
    queryFn: getOnboarding,
  })
  const primaryGroup = groups.data?.find((group) => group.is_primary)
  const nextStep = onboarding.data?.find((step) => !step.completed)
  const completedSteps =
    onboarding.data?.filter((step) => step.completed).length ?? 0

  return (
    <Panel
      id={id}
      className={
        primaryGroup ? 'home-panel home-panel--personalized' : 'home-panel'
      }
    >
      <AppPanelHeader>ИПМКН Старт</AppPanelHeader>
      <Group>
        <Div className={`hero${primaryGroup ? ' hero--compact' : ''}`}>
          <Text className="eyebrow">ТУЛГУ · ПЕРВЫЙ КУРС</Text>
          <Title level="1">
            {primaryGroup ? `Сегодня у ${primaryGroup.code}` : 'Укажите свою группу'}
          </Title>
          <Text className="hero__text">
            {primaryGroup
              ? 'Ближайшая пара появится здесь после обновления расписания.'
              : 'Это откроет расписание, контакт тьютора и персональные напоминания.'}
          </Text>
          <Button
            size="l"
            stretched
            onClick={() =>
              void navigator.push(PANEL_PATHS.schedule)
            }
          >
            {primaryGroup ? 'Открыть расписание' : 'Указать свою группу'}
          </Button>
        </Div>
      </Group>

      {primaryGroup && (
        <Group header={<Header>Быстрый старт</Header>}>
          <Div className="quick-start-grid">
            <button
              className="quick-start-card quick-start-card--tutor"
              type="button"
              onClick={() => {
                sessionStorage.setItem('ipmkn.moreTarget', 'my-tutor')
                void navigator.push(PANEL_PATHS.more)
              }}
            >
              <span className="quick-start-card__icon">
                <Icon28Users3Outline />
              </span>
              <span className="quick-start-card__title">Мой тьютор</span>
              <span className="quick-start-card__subtitle">Контакт наставника</span>
            </button>
            <button
              className="quick-start-card quick-start-card--links"
              type="button"
              onClick={() => void navigator.push(PANEL_PATHS.resources)}
            >
              <span className="quick-start-card__icon">
                <Icon28LinkOutline />
              </span>
              <span className="quick-start-card__title">Полезные ссылки</span>
              <span className="quick-start-card__subtitle">Сервисы и сообщества</span>
            </button>
            <button
              className="quick-start-card quick-start-card--rooms"
              type="button"
              onClick={() => {
                setMapTargetRoom('Гл-425')
                void navigator.push(PANEL_PATHS.map)
              }}
            >
              <span className="quick-start-card__icon">
                <Icon28PlaceOutline />
              </span>
              <span className="quick-start-card__title">Важные кабинеты</span>
              <span className="quick-start-card__subtitle">Дирекция и профком</span>
            </button>
            <button
              className="quick-start-card quick-start-card--about"
              type="button"
              onClick={() => void navigator.push(PANEL_PATHS.about)}
            >
              <span className="quick-start-card__icon">
                <Icon28InfoCircleOutline />
              </span>
              <span className="quick-start-card__title">О проекте</span>
              <span className="quick-start-card__subtitle">Команда и контакты</span>
            </button>
          </Div>
        </Group>
      )}

      {primaryGroup && nextStep && (
        <Group header={<Header>Маршрут первокурсника</Header>}>
          <SimpleCell
            subtitle={`${completedSteps} из ${onboarding.data?.length ?? 0} · ${nextStep.description}`}
            onClick={() => void navigator.push(PANEL_PATHS.onboarding)}
          >
            Следующий шаг: {nextStep.title}
          </SimpleCell>
        </Group>
      )}

      <Div className="home-disclaimer">
        Приложение создано тьюторским сообществом ИПМКН и не заменяет официальные сообщения ТулГУ.
      </Div>
    </Panel>
  )
}
