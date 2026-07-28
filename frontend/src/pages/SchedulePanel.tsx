import {
  Banner,
  Button,
  Group,
  Header,
  Panel,
  PanelHeader,
  Placeholder,
  SimpleCell,
} from '@vkontakte/vkui'

export function SchedulePanel({ id = 'schedule' }: { id?: string }) {
  return (
    <Panel id={id}>
      <PanelHeader>Расписание</PanelHeader>
      <Group>
        <Banner
          title="Сначала выберите группу"
          subtitle="Выбор сохранится на этом устройстве. В следующем обновлении здесь появятся пары из открытого расписания ТулГУ."
          actions={<Button>Выбрать группу</Button>}
        />
      </Group>
      <Group header={<Header>Сегодня</Header>}>
        <Placeholder>После выбора группы здесь будут занятия и аудитории.</Placeholder>
      </Group>
      <Group header={<Header>Полезно</Header>}>
        <SimpleCell subtitle="Официальный источник откроется в новой вкладке">
          Расписание ТулГУ
        </SimpleCell>
      </Group>
    </Panel>
  )
}
