import {
  Icon28LinkOutline,
} from '@vkontakte/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  Div,
  FormItem,
  Group,
  Header,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  SimpleCell,
  Text,
  Textarea,
  Title,
} from '@vkontakte/vkui'
import { FormEvent, useState } from 'react'

import { reportIssue } from '../api/onboarding'
import { getResources } from '../api/students'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'

interface LegalPanelProps {
  id: string
  kind: 'about' | 'privacy'
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

export function LegalPanel({ id, kind }: LegalPanelProps) {
  const navigator = useRouteNavigator()
  const privacy = kind === 'privacy'
  const [feedback, setFeedback] = useState('')
  const resources = useQuery({
    queryKey: ['resources'],
    queryFn: getResources,
  })
  const profburo = resources.data?.find(
    (resource) => resource.slug === 'profburo-ipmkn',
  )
  const feedbackMutation = useMutation({
    mutationFn: (message: string) => reportIssue('project-feedback', message),
    onSuccess: () => setFeedback(''),
  })
  const submitFeedback = (event: FormEvent) => {
    event.preventDefault()
    const message = feedback.trim()
    if (message.length >= 5) feedbackMutation.mutate(message)
  }

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
                Приложение сохраняет VK ID, имя и фамилию из профиля VK,
                выбранные учебные группы, время входов, прогресс маршрута,
                настройки напоминаний, регистрации на события, оценки ответов и
                обращения в поддержку. Email, номер телефона и точная
                геолокация не запрашиваются.
              </Text>
              <Text>
                Эти данные нужны для авторизации, показа расписания и тьютора,
                сохранения настроек и работы поддержки. Список пользователей
                доступен только администраторам приложения; другим студентам он
                не показывается. Данные не продаются и не используются для
                рекламных рассылок.
              </Text>
              <Text>
                Секреты интеграций хранятся только на сервере. Если помощник не
                находит точный ответ, для улучшения базы сохраняются хэш,
                сокращённый текст запроса со скрытыми цифрами и тип результата;
                эта запись не связана с аккаунтом. Внешний ИИ-провайдер в
                текущей конфигурации отключён. При открытии карт контент 2ГИС
                загружается напрямую с его серверов.
              </Text>
              <Text>
                Чтобы уточнить, исправить или удалить связанные с аккаунтом
                данные, напишите команде проекта через сообщество профбюро
                ИПМКН. Обращения обрабатываются вручную.
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
                контакты тьюторов, студенческие события и ответы на частые
                организационные вопросы.
              </Text>
              <Text>
                Материалы поддерживает тьюторское сообщество ИПМКН. Расписание
                загружается из открытого сервиса ТулГУ, адреса сверяются с
                официальным каталогом университета и карточками 2ГИС, а ссылки
                на тьюторов предоставляет команда проекта.
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
      <Group
        header={
          <Header>
            {privacy ? 'Обращения по данным' : 'Ответственная команда и контакты'}
          </Header>
        }
      >
          {profburo && (
            <SimpleCell
              key={profburo.id}
              before={<Icon28LinkOutline />}
              subtitle={profburo.description}
              onClick={() => void openExternalUrl(profburo.url)}
            >
              {profburo.title}
            </SimpleCell>
          )}
          {resources.isError && (
            <Banner
              title="Контакты временно недоступны"
              subtitle="Попробуйте обновить страницу немного позже."
            />
          )}
      </Group>
      <Group header={<Header>Версия</Header>}>
        <Div>
          <Text>Версия {APP_VERSION}</Text>
          {privacy && <Text className="muted">Обновлено 1 сентября 2026 года</Text>}
        </Div>
      </Group>
      {!privacy && (
        <Group header={<Header>Обратная связь</Header>}>
          <form onSubmit={submitFeedback} className="project-feedback-form">
            <FormItem
              top="Расскажите, что можно улучшить"
              bottom="Сообщение увидит команда проекта. Минимум 5 символов."
            >
              <Textarea
                value={feedback}
                maxLength={2000}
                placeholder="Идея, пожелание или найденная проблема"
                onChange={(event) => setFeedback(event.target.value)}
              />
            </FormItem>
            <Div>
              <Button
                type="submit"
                size="l"
                stretched
                loading={feedbackMutation.isPending}
                disabled={feedback.trim().length < 5 || feedbackMutation.isPending}
              >
                Отправить
              </Button>
            </Div>
            {feedbackMutation.isSuccess && (
              <Banner title="Спасибо!" subtitle="Сообщение отправлено команде проекта." />
            )}
            {feedbackMutation.isError && (
              <Banner title="Не удалось отправить" subtitle="Проверьте соединение и попробуйте ещё раз." />
            )}
          </form>
        </Group>
      )}
    </Panel>
  )
}
