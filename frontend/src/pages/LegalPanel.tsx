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
                «ИПМКН Старт» создан для первокурсников ТулГУ, которым нужно
                быстро сориентироваться в первых учебных неделях.
              </Text>
              <Text>
                В одном месте собраны расписание, навигация по корпусам,
                студенческие события и ответы на частые организационные вопросы.
              </Text>
              <Text>
                Тьюторское сообщество ИПМКН поддерживает материалы и помогает
                направить вопрос к человеку, когда готового ответа недостаточно.
              </Text>
              <Text>
                Приложение создано тьюторским сообществом ИПМКН и не заменяет
                официальные сообщения ТулГУ. Важные решения сверяйте с сайтом,
                расписанием и официальными сообществами университета.
              </Text>
            </>
          )}
        </Div>
      </Group>
      {!privacy && (
        <Group header={<Header>Ответственная команда и контакт</Header>}>
          <Div className="legal-copy">
            <Title level="3">Тьюторское сообщество ИПМКН</Title>
            <Text>
              Ссылки на страницу проекта, сообщения об ошибках и профбюро
              управляются редакторами и будут показаны здесь из общего каталога.
            </Text>
          </Div>
        </Group>
      )}
      <Group header={<Header>Версия</Header>}>
        <Div>
          <Text>Версия разработки 0.1</Text>
        </Div>
      </Group>
    </Panel>
  )
}
