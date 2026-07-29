import {
  Icon20HomeOutline,
  Icon20PinOutline,
  Icon20PlaceOutline,
} from '@vkontakte/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Banner,
  Button,
  ButtonGroup,
  Div,
  Group,
  Header,
  Panel,
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
import { AppPanelHeader } from '../components/AppPanelHeader'
import { MapCanvas } from '../components/MapCanvas'
import { openExternalUrl } from '../platformLinks'

export function MapPanel({ id = 'map' }: { id?: string }) {
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
  const academicBuildings = useMemo(
    () =>
      (buildings.data ?? []).filter(
        (building) => building.kind === 'academic',
      ),
    [buildings.data],
  )
  const dormitories = useMemo(
    () =>
      (buildings.data ?? []).filter(
        (building) => building.kind === 'dormitory',
      ),
    [buildings.data],
  )
  const sortedBuildings = useMemo(
    () =>
      [...academicBuildings].sort((left, right) => {
        const leftPin = pinnedIds.indexOf(left.id)
        const rightPin = pinnedIds.indexOf(right.id)
        if (leftPin >= 0 || rightPin >= 0) {
          if (leftPin < 0) return 1
          if (rightPin < 0) return -1
          return leftPin - rightPin
        }
        return left.sort_order - right.sort_order
      }),
    [academicBuildings, pinnedIds],
  )
  const filteredLocations = useMemo(
    () =>
      [...sortedBuildings, ...dormitories].filter((building) =>
        buildingMatchesQuery(building, search),
      ),
    [dormitories, search, sortedBuildings],
  )
  const filteredBuildings = filteredLocations.filter(
    (building) => building.kind === 'academic',
  )
  const filteredDormitories = filteredLocations.filter(
    (building) => building.kind === 'dormitory',
  )
  const targetBuilding = targetRoom
    ? matchBuildingByLocation(targetRoom, buildings.data ?? [])
    : undefined
  const searchSelection = search.trim() ? filteredLocations[0] : undefined
  const selected =
    buildings.data?.find((building) => building.id === selectedId) ??
    searchSelection ??
    targetBuilding ??
    (!targetRoom ? sortedBuildings[0] : undefined)
  const unknownTarget =
    Boolean(targetRoom) && buildings.isSuccess && !targetBuilding
  const importantRooms = useMemo(() => {
    const grouped = new Map<
      string,
      {
        building: (typeof academicBuildings)[number]
        title: string
        floor: string
        roomNumbers: string[]
      }
    >()
    for (const building of academicBuildings) {
      for (const room of building.rooms) {
        const key = `${building.id}:${room.title}`
        const existing = grouped.get(key)
        if (existing) {
          existing.roomNumbers.push(room.room_number)
        } else {
          grouped.set(key, {
            building,
            title: room.title,
            floor: room.floor,
            roomNumbers: [room.room_number],
          })
        }
      }
    }
    return [...grouped.values()]
  }, [academicBuildings])

  return (
    <Panel id={id}>
      <AppPanelHeader>Корпуса ТулГУ</AppPanelHeader>
      <Group>
        {selected && (
          <>
            <Div className="campus-heading">
              <Text className="eyebrow">{selected.short_name}</Text>
              <Title level="2">{selected.name}</Title>
              <Text>{selected.address}</Text>
              {selected.entrance_hint &&
                selected.complex_slug !== 'main-9' && (
                  <Text className="muted">{selected.entrance_hint}</Text>
                )}
            </Div>
            <MapCanvas key={selected.id} building={selected} />
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
          </>
        )}
        <Search
          value={search}
          placeholder="Корпус, общежитие или кабинет"
          onChange={(event) => {
            setSelectedId(undefined)
            setSearch(event.target.value)
          }}
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
        {buildings.isSuccess && filteredLocations.length === 0 && (
          <Banner
            title="Ничего не найдено"
            subtitle="Поиск ограничен объектами ТулГУ из каталога приложения."
          />
        )}
      </Group>

      <Group>
        <Div>
          <Text className="campus-complex">
            Главный и 9-й корпуса считаются отдельными корпусами, но сейчас
            соединены в одно здание. Вход в главный корпус осуществляется через
            9-й.
          </Text>
        </Div>
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
                  <Icon20PinOutline
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
              onClick={() => {
                setSearch('')
                setSelectedId(building.id)
              }}
            >
              {building.short_name}
            </SimpleCell>
          )
        })}
      </Group>

      <Group header={<Header>Общежития</Header>}>
        {filteredDormitories.map((dormitory) => (
          <SimpleCell
            key={dormitory.id}
            selected={dormitory.id === selected?.id}
            before={<Icon20HomeOutline aria-hidden />}
            subtitle={dormitory.address}
            onClick={() => {
              setSearch('')
              setSelectedId(dormitory.id)
            }}
          >
            {dormitory.short_name}
          </SimpleCell>
        ))}
      </Group>

      <Group header={<Header>Часто нужные кабинеты</Header>}>
        {importantRooms.map(({ building, title, floor, roomNumbers }) => (
          <SimpleCell
            key={`${building.id}:${title}`}
            subtitle={`${building.short_name} · ${floor} этаж`}
            indicator={roomNumbers
              .map((roomNumber) => `Гл-${roomNumber}`)
              .join(' и ')}
            onClick={() => {
              setSearch('')
              setSelectedId(building.id)
            }}
          >
            {title}
          </SimpleCell>
        ))}
      </Group>
    </Panel>
  )
}
