import {
  Icon20ChevronRightOutline,
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
import {
  buildingMatchesQuery,
  consumeMapTargetRoom,
  formatRoomLocation,
  matchBuildingByLocation,
} from '../campusLocation'
import { AppPanelHeader } from '../components/AppPanelHeader'
import { MapCanvas } from '../components/MapCanvas'
import { openExternalUrl } from '../platformLinks'

export function MapPanel({ id = 'map' }: { id?: string }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [buildingsOpen, setBuildingsOpen] = useState(false)
  const [dormitoriesOpen, setDormitoriesOpen] = useState(false)
  const [roomsOpen, setRoomsOpen] = useState(false)
  const [targetRoom] = useState(consumeMapTargetRoom)
  const buildings = useQuery({
    queryKey: ['campus'],
    queryFn: () => getCampusBuildings(),
  })
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
        if (left.complex_slug === 'main-9' && right.complex_slug !== 'main-9') return -1
        if (right.complex_slug === 'main-9' && left.complex_slug !== 'main-9') return 1
        return left.sort_order - right.sort_order
      }),
    [academicBuildings],
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
  const catalogBuildings = useMemo(() => {
    let mainComplexShown = false
    return filteredBuildings.filter((building) => {
      if (building.complex_slug !== 'main-9') return true
      if (mainComplexShown) return false
      mainComplexShown = true
      return true
    })
  }, [filteredBuildings])
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
        directions: string[]
      }
    >()
    for (const building of academicBuildings) {
      for (const room of building.rooms) {
        const key = `${building.id}:${room.title}`
        const existing = grouped.get(key)
        if (existing) {
          existing.roomNumbers.push(room.room_number)
          if (room.directions && !existing.directions.includes(room.directions)) {
            existing.directions.push(room.directions)
          }
        } else {
          grouped.set(key, {
            building,
            title: room.title,
            floor: room.floor,
            roomNumbers: [room.room_number],
            directions: room.directions ? [room.directions] : [],
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
              {selected.complex_slug === 'main-9' && (
                <Text className="campus-complex">
                  Главный и 9-й корпуса — одно здание, вход с улицы Смидович.
                </Text>
              )}
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
            if (event.target.value.trim()) {
              setBuildingsOpen(true)
              setDormitoriesOpen(true)
              setRoomsOpen(true)
            }
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

      <details
        className="campus-catalog"
        open={buildingsOpen}
        onToggle={(event) => setBuildingsOpen(event.currentTarget.open)}
      >
        <summary className="campus-catalog__summary">
          <Header>Все корпуса</Header>
          <Icon20ChevronRightOutline aria-hidden />
        </summary>
        <Group>
        {catalogBuildings.map((building) => {
          const isMainComplex = building.complex_slug === 'main-9'
          const isPinned = isMainComplex
          return (
            <SimpleCell
              key={building.id}
              selected={
                isMainComplex
                  ? selected?.complex_slug === 'main-9'
                  : building.id === selected?.id
              }
              before={
                isPinned ? (
                  <Icon20PinOutline
                    className="campus-pin"
                    aria-label="Закреплено"
                  />
                ) : (
                  <Icon20PlaceOutline aria-hidden />
                )
              }
              subtitle={
                isPinned
                  ? `Закреплено · ${building.address}`
                  : building.address
              }
              onClick={() => {
                setSearch('')
                setSelectedId(building.id)
              }}
            >
              {isMainComplex ? 'Главный и 9-й корпуса' : building.short_name}
            </SimpleCell>
          )
        })}
        </Group>
      </details>

      <details
        className="campus-catalog"
        open={dormitoriesOpen}
        onToggle={(event) => setDormitoriesOpen(event.currentTarget.open)}
      >
        <summary className="campus-catalog__summary">
          <Header>Общежития</Header>
          <Icon20ChevronRightOutline aria-hidden />
        </summary>
        <Group>
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
      </details>

      <details
        className="campus-catalog"
        open={roomsOpen}
        onToggle={(event) => setRoomsOpen(event.currentTarget.open)}
      >
        <summary className="campus-catalog__summary">
          <Header>Часто нужные кабинеты</Header>
          <Icon20ChevronRightOutline aria-hidden />
        </summary>
        <Group>
        {importantRooms.map(({
          building,
          title,
          floor,
          roomNumbers,
          directions,
        }) => (
          <SimpleCell
            key={`${building.id}:${title}`}
            subtitle={
              directions.join(' · ') || `${building.short_name} · ${floor} этаж`
            }
            indicator={roomNumbers
              .map((roomNumber) =>
                formatRoomLocation(building.slug, roomNumber, floor),
              )
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
      </details>
    </Panel>
  )
}
