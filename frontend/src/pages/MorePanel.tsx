import {
  Icon28BookSpreadOutline,
  Icon28HelpCircleOutline,
  Icon28PlaceOutline,
  Icon28Users3Outline,
} from '@vkontakte/icons'
import { Group, Panel, PanelHeader, SimpleCell } from '@vkontakte/vkui'

export function MorePanel({ id = 'more' }: { id?: string }) {
  return (
    <Panel id={id}>
      <PanelHeader>Ещё</PanelHeader>
      <Group>
        <SimpleCell
          before={<Icon28Users3Outline />}
          subtitle="Контакты наставника вашей группы"
        >
          Мой тьютор
        </SimpleCell>
        <SimpleCell
          before={<Icon28PlaceOutline />}
          subtitle="Корпуса, аудитории и маршруты"
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
        >
          Помощь
        </SimpleCell>
      </Group>
    </Panel>
  )
}
