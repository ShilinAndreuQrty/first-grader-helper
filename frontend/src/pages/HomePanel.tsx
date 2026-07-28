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
  CardGrid,
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
import { PANEL_PATHS } from '../router'

export function HomePanel({ id = 'home' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const groups = useQuery({ queryKey: ['my-groups'], queryFn: getMyGroups })
  const primaryGroup = groups.data?.find((group) => group.is_primary)

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
                primaryGroup ? PANEL_PATHS.assistant : PANEL_PATHS.more,
              )
            }
          >
            {primaryGroup ? 'Задать вопрос' : 'Указать свою группу'}
          </Button>
        </Div>
      </Group>

      <Group header={<Header>Быстрый старт</Header>}>
        <CardGrid size="s">
          <Card mode="shadow">
            <SimpleCell
              before={<Icon28EducationOutline />}
              subtitle="Пары и аудитории"
              onClick={() => void navigator.push(PANEL_PATHS.schedule)}
            >
              Расписание
            </SimpleCell>
          </Card>
          <Card mode="shadow">
            <SimpleCell
              before={<Icon28CalendarOutline />}
              subtitle="Что будет рядом"
              onClick={() => void navigator.push(PANEL_PATHS.events)}
            >
              События
            </SimpleCell>
          </Card>
          <Card mode="shadow">
            <SimpleCell
              before={<Icon28MessageOutline />}
              subtitle="Проверенные ответы"
              onClick={() => void navigator.push(PANEL_PATHS.assistant)}
            >
              Помощник
            </SimpleCell>
          </Card>
          <Card mode="shadow">
            <SimpleCell
              before={<Icon28PlaceOutline />}
              subtitle="Корпуса и кабинеты"
              onClick={() => void navigator.push(PANEL_PATHS.more)}
            >
              Карта
            </SimpleCell>
          </Card>
        </CardGrid>
      </Group>

      <Group>
        <Banner
          title="Неофициальный проект"
          subtitle="Приложение создано тьюторским сообществом ИПМКН и не заменяет официальные сообщения ТулГУ."
        />
      </Group>
    </Panel>
  )
}
