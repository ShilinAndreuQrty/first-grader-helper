import {
  Icon28CalendarOutline,
  Icon28EducationOutline,
  Icon28MessageOutline,
  Icon28PlaceOutline,
} from '@vkontakte/icons'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  Card,
  Div,
  Group,
  Header,
  Panel,
  PanelHeader,
  SimpleCell,
  Text,
  Title,
} from '@vkontakte/vkui'
import { useQuery } from '@tanstack/react-query'

import { getMyGroups } from '../api/students'
import { getOnboarding } from '../api/onboarding'
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
    <Panel id={id}>
      <PanelHeader>ИПМКН Старт</PanelHeader>
      <Group>
        <Div className="hero">
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
              void navigator.push(
                primaryGroup ? PANEL_PATHS.assistant : PANEL_PATHS.schedule,
              )
            }
          >
            {primaryGroup ? 'Задать вопрос' : 'Указать свою группу'}
          </Button>
        </Div>
      </Group>

      <Group header={<Header>Быстрый старт</Header>}>
        <Div className="quick-start-grid">
          <Card mode="shadow" className="quick-start-card quick-start-card--schedule">
            <SimpleCell
              before={
                <span className="quick-start-card__icon">
                  <Icon28EducationOutline />
                </span>
              }
              subtitle="Пары и аудитории"
              onClick={() => void navigator.push(PANEL_PATHS.schedule)}
            >
              Расписание
            </SimpleCell>
          </Card>
          <Card mode="shadow" className="quick-start-card quick-start-card--events">
            <SimpleCell
              before={
                <span className="quick-start-card__icon">
                  <Icon28CalendarOutline />
                </span>
              }
              subtitle="Что будет рядом"
              onClick={() => void navigator.push(PANEL_PATHS.events)}
            >
              События
            </SimpleCell>
          </Card>
          <Card mode="shadow" className="quick-start-card quick-start-card--assistant">
            <SimpleCell
              before={
                <span className="quick-start-card__icon">
                  <Icon28MessageOutline />
                </span>
              }
              subtitle="Проверенные ответы"
              onClick={() => void navigator.push(PANEL_PATHS.assistant)}
            >
              Помощник
            </SimpleCell>
          </Card>
          <Card mode="shadow" className="quick-start-card quick-start-card--map">
            <SimpleCell
              before={
                <span className="quick-start-card__icon">
                  <Icon28PlaceOutline />
                </span>
              }
              subtitle="Корпуса и кабинеты"
              onClick={() => void navigator.push(PANEL_PATHS.map)}
            >
              Карта
            </SimpleCell>
          </Card>
        </Div>
      </Group>

      {nextStep && (
        <Group header={<Header>Маршрут первокурсника</Header>}>
          <SimpleCell
            subtitle={`${completedSteps} из ${onboarding.data?.length ?? 0} · ${nextStep.description}`}
            onClick={() => void navigator.push(PANEL_PATHS.onboarding)}
          >
            Следующий шаг: {nextStep.title}
          </SimpleCell>
        </Group>
      )}

      <Group>
        <Banner
          title="Проверяйте важное"
          subtitle="Приложение создано тьюторским сообществом ИПМКН и не заменяет официальные сообщения ТулГУ."
        />
      </Group>
    </Panel>
  )
}
