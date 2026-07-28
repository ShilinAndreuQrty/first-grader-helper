import {
  Banner,
  Button,
  Group,
  Header,
  Panel,
  PanelHeader,
  Placeholder,
} from '@vkontakte/vkui'

export function EventsPanel({ id = 'events' }: { id?: string }) {
  return (
    <Panel id={id}>
      <PanelHeader>События</PanelHeader>
      <Group>
        <Banner
          title="Календарь первокурсника"
          subtitle="Встречи с тьюторами, дедлайны и университетские события."
          actions={<Button mode="secondary">Настроить напоминания</Button>}
        />
      </Group>
      <Group header={<Header>Ближайшее</Header>}>
        <Placeholder>Опубликованных событий пока нет.</Placeholder>
      </Group>
    </Panel>
  )
}
