import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Banner,
  Button,
  Card,
  CardGrid,
  Div,
  FormItem,
  Group,
  Header,
  Link,
  Panel,
  PanelHeader,
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

function AnswerCard({ entry }: { entry: FaqEntry }) {
  const feedback = useMutation({
    mutationFn: (isHelpful: boolean) => sendFaqFeedback(entry.id, isHelpful),
  })

  return (
    <Card mode="shadow" className="answer-card">
      <Div>
        <Text className="eyebrow">{entry.category}</Text>
        <Title level="3">{entry.question}</Title>
        {entry.answer_markdown.split('\n').map((paragraph) => (
          <Text key={paragraph} className="answer-card__paragraph">
            {paragraph}
          </Text>
        ))}
        {entry.source_url && (
          <Link href={entry.source_url} target="_blank">
            Открыть источник
          </Link>
        )}
        {entry.is_time_sensitive && (
          <Text className="muted">
            Сведения могут меняться. Проверено:{' '}
            {entry.verified_at
              ? new Date(entry.verified_at).toLocaleDateString('ru-RU')
              : 'дата не указана'}
          </Text>
        )}
        <div className="answer-feedback">
          {feedback.isSuccess ? (
            <Text className="muted">Спасибо за оценку</Text>
          ) : (
            <>
              <Button
                size="s"
                mode="tertiary"
                onClick={() => feedback.mutate(true)}
              >
                Полезно
              </Button>
              <Button
                size="s"
                mode="tertiary"
                onClick={() => feedback.mutate(false)}
              >
                Есть ошибка
              </Button>
            </>
          )}
        </div>
      </Div>
    </Card>
  )
}

function Result({
  result,
  onSelect,
}: {
  result: AssistantResponse
  onSelect: (id: string) => void
}) {
  if (result.answer) return <AnswerCard entry={result.answer} />
  if (result.suggestions.length) {
    return (
      <Card mode="outline">
        <SimpleCell multiline subtitle="Выберите наиболее подходящий вариант">
          Уточните вопрос
        </SimpleCell>
        {result.suggestions.map((suggestion) => (
          <SimpleCell
            key={suggestion.faq_id}
            subtitle={suggestion.category}
            onClick={() => onSelect(suggestion.faq_id)}
          >
            {suggestion.question}
          </SimpleCell>
        ))}
      </Card>
    )
  }
  return (
    <Banner
      title="Точного ответа пока нет"
      subtitle="Попробуйте сформулировать короче или обратитесь к тьютору. Запрос сохранён анонимно и поможет дополнить базу."
    />
  )
}

export function AssistantPanel({ id = 'assistant' }: { id?: string }) {
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>()
  const categories = useQuery({
    queryKey: ['faq-categories'],
    queryFn: getFaqCategories,
  })
  const faq = useQuery({
    queryKey: ['faq', categoryId, search],
    queryFn: () => getFaq(categoryId, search),
  })
  const assistant = useMutation({
    mutationFn: ({ query, id }: { query: string; id?: string }) =>
      askAssistant(query, id),
  })

  const visibleFaq = useMemo(() => faq.data?.slice(0, 12) ?? [], [faq.data])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const query = text.trim()
    if (query.length >= 2) assistant.mutate({ query })
  }

  return (
    <Panel id={id}>
      <PanelHeader>Помощник</PanelHeader>
      <Group>
        <Div className="assistant-intro">
          <Title level="2">Спросите как есть</Title>
          <Text>
            Помощник ищет только по проверенным материалам тьюторского
            сообщества и показывает источник, когда он указан.
          </Text>
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
          <Div>
            <Button
              type="submit"
              size="l"
              stretched
              loading={assistant.isPending}
              disabled={text.trim().length < 2}
            >
              Найти ответ
            </Button>
          </Div>
        </form>
        {assistant.isError && (
          <Banner
            title="Не удалось связаться с помощником"
            subtitle="Проверьте подключение и попробуйте ещё раз."
          />
        )}
        {assistant.data && (
          <Div>
            <Result
              result={assistant.data}
              onSelect={(id) =>
                assistant.mutate({ query: text.trim(), id })
              }
            />
          </Div>
        )}
      </Group>

      <Group header={<Header>Каталог ответов</Header>}>
        <Search
          value={search}
          placeholder="Поиск по вопросам"
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
            title="Каталог недоступен"
            subtitle="API ещё не запущен или база пока не заполнена."
          />
        )}
        <CardGrid size="l">
          {visibleFaq.map((entry) => (
            <AnswerCard key={entry.id} entry={entry} />
          ))}
        </CardGrid>
      </Group>
    </Panel>
  )
}
