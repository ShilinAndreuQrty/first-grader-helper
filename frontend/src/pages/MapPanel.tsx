import { useQuery } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  Div,
  Group,
  Header,
  Panel,
  PanelHeader,
  PanelHeaderBack,
  Search,
  SimpleCell,
  Spinner,
  Text,
  Title,
} from '@vkontakte/vkui'
import { useState } from 'react'

import { getCampusBuildings } from '../api/campus'
import { MapCanvas } from '../components/MapCanvas'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'

export function MapPanel({ id = 'map' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const buildings = useQuery({
    queryKey: ['campus', search],
    queryFn: () => getCampusBuildings(search),
  })
  const selected =
    buildings.data?.find((building) => building.id === selectedId) ??
    buildings.data?.[0]

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
        Карта
      </PanelHeader>
      <Group>
        <Search
          value={search}
          placeholder="Корпус или кабинет"
          onChange={(event) => setSearch(event.target.value)}
        />
        {buildings.isFetching && <Spinner size="s" />}
        {buildings.isError && (
          <Banner
            title="Каталог временно недоступен"
            subtitle="Попробуйте снова позднее."
          />
        )}
        {buildings.data?.length === 0 && (
          <Banner
            title="Ничего не найдено"
            subtitle="Публично показываются только проверенные места."
          />
        )}
      </Group>
      {selected && (
        <>
          <Group>
            <Div className="campus-heading">
              <Text className="eyebrow">{selected.short_name}</Text>
              <Title level="2">{selected.name}</Title>
              <Text>{selected.address}</Text>
              {selected.entrance_hint && (
                <Text className="muted">{selected.entrance_hint}</Text>
              )}
            </Div>
            <MapCanvas building={selected} />
            <Div>
              <Button
                stretched
                onClick={() => void openExternalUrl(selected.dgis_url)}
              >
                Открыть в 2ГИС
              </Button>
            </Div>
          </Group>
          <Group header={<Header>Корпуса</Header>}>
            {buildings.data?.map((building) => (
              <SimpleCell
                key={building.id}
                selected={building.id === selected.id}
                subtitle={building.address}
                onClick={() => setSelectedId(building.id)}
              >
                {building.short_name}
              </SimpleCell>
            ))}
          </Group>
          <Group header={<Header>Полезные кабинеты</Header>}>
            {selected.rooms.length === 0 && (
              <Banner
                title="Проверенных кабинетов пока нет"
                subtitle="Редактор сможет добавить их в админ-панели."
              />
            )}
            {selected.rooms.map((room) => (
              <SimpleCell
                key={room.id}
                subtitle={[room.floor && `${room.floor} этаж`, room.directions]
                  .filter(Boolean)
                  .join(' · ')}
                indicator={room.room_number}
              >
                {room.title}
              </SimpleCell>
            ))}
          </Group>
        </>
      )}
    </Panel>
  )
}

