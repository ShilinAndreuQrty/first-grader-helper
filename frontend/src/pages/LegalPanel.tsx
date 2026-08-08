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

export function LegalPanel({ id, kind }: LegalPanelProps) {
  const navigator = useRouteNavigator()
  const privacy = kind === 'privacy'
  const [feedback, setFeedback] = useState('')
  const resources = useQuery({
    queryKey: ['resources'],
    queryFn: getResources,
    enabled: !privacy,
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
        <Group header={<Header>Ответственная команда и контакты</Header>}>
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
      )}
      <Group header={<Header>Версия</Header>}>
        <Div>
          <Text>Версия разработки 0.1</Text>
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
