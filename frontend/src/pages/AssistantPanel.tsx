import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  ButtonGroup,
  Card,
  CardGrid,
  Div,
  FormItem,
  Group,
  Header,
  Panel,
  Search,
  SimpleCell,
  Spinner,
  Text,
  Textarea,
  Title,
} from '@vkontakte/vkui'

import {
  AssistantResponse,
  FaqEntry,
  askAssistant,
  getFaq,
  getFaqCategories,
  sendFaqFeedback,
} from '../api/knowledge'
import { openExternalUrl } from '../platformLinks'
import { AppPanelHeader } from '../components/AppPanelHeader'
import { PANEL_PATHS } from '../router'
import { setMoreReturnPath } from '../navigation'

const HISTORY_KEY = 'ipmkn.assistant-history-v1'
const QUICK_QUESTIONS = [
  'Кто такой тьютор?',
  'Где находится дирекция?',
  'Что такое профсоюз студентов и аспирантов?',
  'Что такое академический отпуск?',
  'Кому предоставляются места в общежитии?',
]

interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  text?: string
  question?: string
  result?: AssistantResponse
}

function readHistory(): ChatTurn[] {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(HISTORY_KEY) ?? '[]',
    ) as unknown
    return Array.isArray(parsed)
      ? parsed.filter(isChatTurn).slice(-16)
      : []
  } catch {
    return []
  }
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    (candidate.text === undefined || typeof candidate.text === 'string') &&
    (candidate.question === undefined ||
      typeof candidate.question === 'string') &&
    (candidate.result === undefined ||
      (typeof candidate.result === 'object' && candidate.result !== null))
  )
}

function AnswerText({ text }: { text: string }) {
  return text.split('\n').map((paragraph, index) =>
    paragraph ? (
      <Text key={`${index}-${paragraph}`} className="answer-card__paragraph">
        {paragraph}
      </Text>
    ) : null,
  )
}

function OfficialSource({ result }: { result: AssistantResponse }) {
  if (!result.official_source) return null
  return (
    <Button
      size="s"
      mode="secondary"
      onClick={() => void openExternalUrl(result.official_source!.url)}
    >
      Подробнее на официальном сайте ТулГУ
    </Button>
  )
}

function AnswerActions({
  result,
  onTutor,
}: {
  result: AssistantResponse
  onTutor: () => void
}) {
  const feedback = useMutation({
    mutationFn: (helpful: boolean) =>
      Promise.all(
        result.faq_ids.map((faqId) => sendFaqFeedback(faqId, helpful)),
      ),
  })
  return (
    <>
      <ButtonGroup className="answer-feedback" mode="horizontal" gap="s">
        <Button
          size="s"
          mode="tertiary"
          disabled={
            result.faq_ids.length === 0 ||
            feedback.isPending ||
            feedback.isSuccess
          }
          onClick={() => feedback.mutate(true)}
        >
          Полезно
        </Button>
        <Button
          size="s"
          mode="tertiary"
          disabled={
            result.faq_ids.length === 0 ||
            feedback.isPending ||
            feedback.isSuccess
          }
          onClick={() => feedback.mutate(false)}
        >
          Не помогло
        </Button>
        <Button size="s" mode="tertiary" onClick={onTutor}>
          Обратиться к тьютору
        </Button>
      </ButtonGroup>
      {feedback.isSuccess && <Text className="muted">Спасибо за оценку.</Text>}
      {feedback.isError && (
        <Text className="muted" role="alert">
          Не удалось отправить действие. Попробуйте ещё раз.
        </Text>
      )}
    </>
  )
}

function AssistantResult({
  result,
  onSelect,
  onTutor,
}: {
  result: AssistantResponse
  onSelect: (id: string) => void
  onTutor: () => void
}) {
  if (result.type === 'answer' && (result.message || result.answer)) {
    return (
      <>
        <AnswerText
          text={result.message ?? result.answer?.answer_markdown ?? ''}
        />
        <OfficialSource result={result} />
        <AnswerActions result={result} onTutor={onTutor} />
      </>
    )
  }
  if (result.suggestions.length > 0) {
    return (
      <>
        <Text>Нашлось несколько близких тем. Выберите подходящую:</Text>
        <div className="assistant-suggestions">
          {result.suggestions.map((suggestion) => (
            <Button
              key={suggestion.faq_id}
              size="s"
              mode="secondary"
              onClick={() => onSelect(suggestion.faq_id)}
            >
              {suggestion.question}
            </Button>
          ))}
        </div>
      </>
    )
  }
  return (
    <>
      <Text>
        В опубликованной базе пока нет достаточно точного ответа. Я не буду
        додумывать факты — попробуйте уточнить вопрос или напишите тьютору.
      </Text>
      <Button size="s" mode="secondary" onClick={onTutor}>
        Обратиться к тьютору
      </Button>
    </>
  )
}

function FaqCard({ entry }: { entry: FaqEntry }) {
  return (
    <Card mode="shadow" className="answer-card">
      <Div>
        <Text className="eyebrow">{entry.category}</Text>
        <Title level="3">{entry.question}</Title>
        <AnswerText text={entry.answer_markdown} />
        {entry.source_url && (
          <Button
            size="s"
            mode="tertiary"
            onClick={() => void openExternalUrl(entry.source_url!)}
          >
            Открыть источник
          </Button>
        )}
      </Div>
    </Card>
  )
}

export function AssistantPanel({ id = 'assistant' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>()
  const [turns, setTurns] = useState<ChatTurn[]>(readHistory)
  const [failedQuestion, setFailedQuestion] = useState('')
  const categories = useQuery({
    queryKey: ['faq-categories'],
    queryFn: getFaqCategories,
  })
  const faq = useQuery({
    queryKey: ['faq', categoryId, search],
    queryFn: () => getFaq(categoryId, search),
  })
  const assistant = useMutation({
    mutationFn: ({ query, faqId }: { query: string; faqId?: string }) =>
      askAssistant(query, faqId),
  })
  const visibleFaq = faq.data ?? []

  useEffect(() => {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(turns.slice(-16)))
  }, [turns])

  const openTutor = () => {
    setMoreReturnPath(PANEL_PATHS.assistant)
    void navigator.push(PANEL_PATHS.more)
  }

  const sendQuestion = (
    question: string,
    options: { addUser?: boolean; faqId?: string } = {},
  ) => {
    const normalized = question.trim()
    if (normalized.length < 2 || assistant.isPending) return
    setFailedQuestion('')
    if (options.addUser !== false) {
      setTurns((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'user', text: normalized },
      ])
    }
    setText('')
    assistant.mutate(
      { query: normalized, faqId: options.faqId },
      {
        onSuccess: (result) =>
          setTurns((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              question: normalized,
              result,
            },
          ]),
        onError: () => setFailedQuestion(normalized),
      },
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    sendQuestion(text)
  }

  return (
    <Panel id={id}>
      <AppPanelHeader>Помощник ИПМКН</AppPanelHeader>
      <Group>
        <Div className="assistant-intro">
          <Title level="2">Ответы из проверенной базы</Title>
          <Text>
            Я помогаю с адаптацией, учёбой, тьюторами, профсоюзом, стипендиями и
            общежитием. Я не знаю всё и не заменяю официальные сообщения ТулГУ.
          </Text>
        </Div>
        <Div className="assistant-quick-topics">
          {QUICK_QUESTIONS.map((question) => (
            <Button
              key={question}
              size="s"
              mode="secondary"
              disabled={assistant.isPending}
              onClick={() => sendQuestion(question)}
            >
              {question}
            </Button>
          ))}
        </Div>
        <Div className="assistant-chat" aria-live="polite">
          <div className="chat-message chat-message--assistant">
            Здравствуйте! Задайте вопрос своими словами. Если проверенного ответа
            нет, я честно предложу обратиться к тьютору.
          </div>
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`chat-message chat-message--${turn.role}`}
            >
              {turn.role === 'user' ? (
                turn.text
              ) : turn.result ? (
                <AssistantResult
                  result={turn.result}
                  onTutor={openTutor}
                  onSelect={(faqId) =>
                    sendQuestion(turn.question ?? '', {
                      addUser: false,
                      faqId,
                    })
                  }
                />
              ) : null}
            </div>
          ))}
          {assistant.isPending && (
            <div className="chat-message chat-message--assistant" role="status">
              Ищу подходящие опубликованные материалы…
            </div>
          )}
          {assistant.isError && (
            <div className="chat-message chat-message--error" role="alert">
              <Text>Не удалось получить ответ. История осталась на устройстве.</Text>
              <Button
                size="s"
                mode="secondary"
                onClick={() =>
                  sendQuestion(failedQuestion, { addUser: false })
                }
              >
                Повторить
              </Button>
            </div>
          )}
        </Div>
        <form onSubmit={submit}>
          <FormItem
            top="Ваш вопрос"
            status={text.length === 1 ? 'error' : 'default'}
            bottom={
              text.length === 1 ? 'Нужно хотя бы два символа' : undefined
            }
          >
            <Textarea
              value={text}
              placeholder="Например: как найти своего тьютора?"
              maxLength={500}
              onChange={(event) => setText(event.target.value)}
            />
          </FormItem>
          <Div className="assistant-compose-actions">
            <Button
              type="submit"
              size="l"
              stretched
              loading={assistant.isPending}
              disabled={text.trim().length < 2}
            >
              Отправить
            </Button>
            {turns.length > 0 && (
              <Button
                type="button"
                size="l"
                mode="secondary"
                onClick={() => {
                  setTurns([])
                  setFailedQuestion('')
                  assistant.reset()
                  sessionStorage.removeItem(HISTORY_KEY)
                }}
              >
                Очистить историю
              </Button>
            )}
          </Div>
        </form>
      </Group>

      <Group header={<Header>Проверенные ответы</Header>}>
        <Search
          value={search}
          placeholder="Поиск по базе вопросов"
          onChange={(event) => setSearch(event.target.value)}
        />
        {categories.isLoading && <Spinner size="s" />}
        <Div className="category-chips">
          <Button
            size="s"
            mode={!categoryId ? 'primary' : 'secondary'}
            onClick={() => setCategoryId(undefined)}
          >
            Все
          </Button>
          {categories.data?.map((category) => (
            <Button
              key={category.id}
              size="s"
              mode={categoryId === category.id ? 'primary' : 'secondary'}
              onClick={() => setCategoryId(category.id)}
            >
              {category.title} · {category.count}
            </Button>
          ))}
        </Div>
        {faq.isError && (
          <Banner
            title="База ответов временно недоступна"
            subtitle="Попробуйте ещё раз позже или обратитесь к тьютору."
          />
        )}
        {faq.isSuccess && visibleFaq.length === 0 && (
          <SimpleCell multiline disabled subtitle="Опубликованных материалов по фильтру нет.">
            Ничего не найдено
          </SimpleCell>
        )}
        <CardGrid size="l">
          {visibleFaq.map((entry) => (
            <FaqCard key={entry.id} entry={entry} />
          ))}
        </CardGrid>
      </Group>
    </Panel>
  )
}
