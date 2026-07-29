import {
  Icon28BugOutline,
  Icon28LinkOutline,
} from '@vkontakte/icons'
import { useQuery } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Div,
  Group,
  Header,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  SimpleCell,
  Text,
  Title,
} from '@vkontakte/vkui'

import { getResources } from '../api/students'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'

interface LegalPanelProps {
  id: string
  kind: 'about' | 'privacy'
}

export function LegalPanel({ id, kind }: LegalPanelProps) {
  const navigator = useRouteNavigator()
  const privacy = kind === 'privacy'
  const resources = useQuery({
    queryKey: ['resources'],
    queryFn: getResources,
    enabled: !privacy,
  })
  const aboutResources =
    resources.data?.filter((resource) =>
      resource.contexts.includes('about'),
    ) ?? []

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
                Для работы сохраняются VK ID, имя и фамилия из профиля VK,
                выбранные группы, время первого входа и последней активности,
                прогресс, настройки напоминаний и оценки ответов. Email, телефон
                и геолокация не запрашиваются.
              </Text>
              <Text>
                Суперадминистратор приложения видит имя, ссылку на профиль VK,
                основную группу и даты активности — это нужно для поддержки и
                проверки доступа. Остальным пользователям этот список недоступен.
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
              Контакты берутся из общего каталога и обновляются без изменения
              этого экрана.
            </Text>
          </Div>
          {aboutResources.map((resource) => (
            <SimpleCell
              key={resource.id}
              before={<Icon28LinkOutline />}
              subtitle={resource.description}
              onClick={() => void openExternalUrl(resource.url)}
            >
              {resource.title}
            </SimpleCell>
          ))}
          <SimpleCell
            before={<Icon28BugOutline />}
            subtitle="Сообщение попадёт в очередь редакторов без контактных данных"
            onClick={() => void navigator.push(PANEL_PATHS.onboarding)}
          >
            Сообщить об ошибке
          </SimpleCell>
          {resources.isError && (
            <Banner
              title="Контакты временно недоступны"
              subtitle="Форма сообщения об ошибке продолжает работать."
            />
          )}
          {resources.isSuccess &&
            !aboutResources.some(
              (resource) => resource.slug === 'project-community',
            ) && (
              <Div>
                <Text className="muted">
                  Отдельная страница проекта пока не указана редакторами.
                </Text>
              </Div>
            )}
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
