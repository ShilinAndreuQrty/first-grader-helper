import { Icon20PlaceOutline, Icon20Verified } from '@vkontakte/icons'
import { useQuery } from '@tanstack/react-query'
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router'
import {
  Banner,
  Button,
  ButtonGroup,
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
import { useMemo, useState } from 'react'

import { getCampusBuildings } from '../api/campus'
import { getSchedule } from '../api/schedule'
import { getMyGroups } from '../api/students'
import {
  buildingMatchesQuery,
  consumeMapTargetRoom,
  matchBuildingByLocation,
} from '../campusLocation'
import { MapCanvas } from '../components/MapCanvas'
import { openExternalUrl } from '../platformLinks'
import { PANEL_PATHS } from '../router'

export function MapPanel({ id = 'map' }: { id?: string }) {
  const navigator = useRouteNavigator()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [targetRoom] = useState(consumeMapTargetRoom)
  const buildings = useQuery({
    queryKey: ['campus'],
    queryFn: () => getCampusBuildings(),
  })
  const savedGroups = useQuery({
    queryKey: ['my-groups'],
    queryFn: getMyGroups,
  })
  const primaryGroup = savedGroups.data?.find((group) => group.is_primary)
  const schedule = useQuery({
    queryKey: ['schedule', primaryGroup?.code],
    queryFn: () => getSchedule(primaryGroup!.code),
    enabled: Boolean(primaryGroup),
  })

  const pinnedIds = useMemo(() => {
    const result: string[] = []
    for (const lesson of schedule.data?.lessons ?? []) {
      const building = matchBuildingByLocation(
        lesson.room,
        buildings.data ?? [],
      )
      if (building && !result.includes(building.id)) result.push(building.id)
    }
    return result
  }, [buildings.data, schedule.data])
  const sortedBuildings = useMemo(
    () =>
      [...(buildings.data ?? [])].sort((left, right) => {
        const leftPin = pinnedIds.indexOf(left.id)
        const rightPin = pinnedIds.indexOf(right.id)
        if (leftPin >= 0 || rightPin >= 0) {
          if (leftPin < 0) return 1
          if (rightPin < 0) return -1
          return leftPin - rightPin
        }
        return left.sort_order - right.sort_order
      }),
    [buildings.data, pinnedIds],
  )
  const filteredBuildings = useMemo(
    () =>
      sortedBuildings.filter((building) =>
        buildingMatchesQuery(building, search),
      ),
    [search, sortedBuildings],
  )
  const targetBuilding = targetRoom
    ? matchBuildingByLocation(targetRoom, buildings.data ?? [])
    : undefined
  const searchSelection = search.trim() ? filteredBuildings[0] : undefined
  const selected =
    searchSelection ??
    buildings.data?.find((building) => building.id === selectedId) ??
    targetBuilding ??
    (!targetRoom ? sortedBuildings[0] : undefined)
  const unknownTarget =
    Boolean(targetRoom) && buildings.isSuccess && !targetBuilding

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
        Корпуса ТулГУ
      </PanelHeader>
      <Group>
        <Search
          value={search}
          placeholder="Корпус, адрес или проверенный кабинет"
          onChange={(event) => setSearch(event.target.value)}
        />
        {buildings.isFetching && <Spinner size="s" />}
        {buildings.isError && (
          <Banner
            title="Каталог временно недоступен"
            subtitle="Интерактивная карта не загружается отдельно от каталога."
            actions={
              <Button onClick={() => void buildings.refetch()}>Повторить</Button>
            }
          />
        )}
        {unknownTarget && (
          <Banner
            title={`Корпус для «${targetRoom}» не определён`}
            subtitle="Обозначение не совпало ни с одним проверенным alias. Выберите корпус вручную — приложение не будет угадывать."
          />
        )}
        {buildings.isSuccess && filteredBuildings.length === 0 && (
          <Banner
            title="Ничего не найдено"
            subtitle="Поиск ограничен корпусами ТулГУ и проверенными кабинетами."
          />
        )}
      </Group>

      <Group header={<Header>Все корпуса</Header>}>
        {filteredBuildings.map((building) => {
          const isPinned = pinnedIds.includes(building.id)
          return (
            <SimpleCell
              key={building.id}
              selected={building.id === selected?.id}
              before={
                isPinned ? (
                  <Icon20Verified
                    className="campus-pin"
                    aria-label="Есть в расписании группы"
                  />
                ) : (
                  <Icon20PlaceOutline aria-hidden />
                )
              }
              subtitle={
                isPinned
                  ? `Есть в расписании выбранной группы · ${building.address}`
                  : building.address
              }
              onClick={() => setSelectedId(building.id)}
            >
              {building.short_name}
            </SimpleCell>
          )
        })}
      </Group>

      {selected && (
        <>
          <Group>
            <Div className="campus-heading">
              <Text className="eyebrow">{selected.short_name}</Text>
              <Title level="2">{selected.name}</Title>
              <Text>{selected.address}</Text>
              {selected.complex_slug === 'main-9' && (
                <Text className="campus-complex">
                  Главный и 9-й корпуса — отдельные корпуса в одном соединённом
                  здании.
                </Text>
              )}
              {selected.entrance_hint && (
                <Text className="muted">{selected.entrance_hint}</Text>
              )}
            </Div>
            <MapCanvas building={selected} />
            <Div>
              <ButtonGroup mode="horizontal" gap="s" stretched>
                <Button
                  onClick={() => void openExternalUrl(selected.dgis_url)}
                >
                  Открыть в 2ГИС
                </Button>
                {selected.source_url && (
                  <Button
                    mode="secondary"
                    onClick={() => void openExternalUrl(selected.source_url!)}
                  >
                    Страница ТулГУ
                  </Button>
                )}
              </ButtonGroup>
            </Div>
          </Group>
          <Group header={<Header>Проверенные кабинеты</Header>}>
            {selected.rooms.length === 0 && (
              <Banner
                title="Проверенных кабинетов пока нет"
                subtitle="Можно открыть объект в 2ГИС или уточнить кабинет у тьютора."
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
