import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Div,
  Group,
  Header,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Text,
  Title,
} from '@vkontakte/vkui'

import { PANEL_PATHS } from '../router'

interface LegalPanelProps {
  id: string
  kind: 'about' | 'privacy'
}

export function LegalPanel({ id, kind }: LegalPanelProps) {
  const navigator = useRouteNavigator()
  const privacy = kind === 'privacy'

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
        {privacy ? 'Конфиденциальность' : 'О проекте'}
      </PanelHeader>
      <Group>
        <Div className="legal-copy">
          <Title level="2">
            {privacy ? 'Как используются данные' : 'ИПМКН Старт'}
          </Title>
          {privacy ? (
            <>
              <Text>
                Для работы сохраняются VK ID, выбранные группы, прогресс,
                настройки напоминаний и оценки ответов. Email, телефон и
                геолокация не запрашиваются.
              </Text>
              <Text>
                Секреты VK остаются на сервере. Неудачные запросы помощника
                сохраняются в обезличенном виде для улучшения базы знаний.
              </Text>
              <Text>
                Владелец данных и контакт для обращений: будут заполнены
                командой до публичного запуска.
              </Text>
            </>
          ) : (
            <>
              <Text>
                Проект тьюторского сообщества ИПМКН ТулГУ помогает
                первокурсникам быстро находить проверенную локальную информацию.
              </Text>
              <Text>
                Это неофициальный сервис и он не заменяет сайт, расписание и
                объявления Тульского государственного университета.
              </Text>
              <Text>
                Ответственная команда и контакт: будут указаны до публичного
                запуска.
              </Text>
            </>
          )}
        </Div>
      </Group>
      <Group header={<Header>Версия</Header>}>
        <Div>
          <Text>Документ-плейсхолдер для разработки · 29.07.2026</Text>
        </Div>
      </Group>
    </Panel>
  )
}

