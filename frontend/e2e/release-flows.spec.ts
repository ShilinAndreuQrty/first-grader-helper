/// <reference lib="dom" />

import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

type SavedGroup = {
  id: string
  code: string
  academic_year: string
  is_primary: boolean
}

async function mockApi(page: Page, initialGroups: SavedGroup[] = []) {
  let savedGroups = [...initialGroups]
  // Match only root API calls. A broader `**/api/**` glob also captures Vite
  // source modules such as `/src/api/auth.ts`.
  await page.route('**://*/api/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const json = (value: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', json: value })

    if (path === '/api/auth/dev') {
      return json({
        csrf_token: 'e2e-csrf',
        mode: 'development',
        app_variant: url.port === '4174' ? 'admin' : 'public',
        user: {
          id: 'user',
          vk_user_id: 1,
          display_name: 'E2E',
          first_name: 'E2E',
          last_name: '',
          profile_url: 'https://vk.ru/id1',
          roles: ['superadmin'],
        },
      })
    }
    if (path === '/api/auth/me') {
      return json({
        id: 'user',
        vk_user_id: 1,
        display_name: 'E2E',
        first_name: 'E2E',
        last_name: '',
        profile_url: 'https://vk.ru/id1',
        roles: ['superadmin'],
      })
    }
    if (path === '/api/me/groups' && request.method() === 'GET') {
      return json(savedGroups)
    }
    if (path === '/api/me/groups/by-code') {
      savedGroups = [
        {
          id: 'group-1',
          code: '220031-22',
          academic_year: '2026/27',
          is_primary: true,
        },
      ]
      return json(savedGroups[0])
    }
    if (path === '/api/schedule/groups') {
      return json({
        groups: ['220031-22'],
        fetched_at: '2026-07-29T10:00:00Z',
        is_stale: false,
      })
    }
    if (path === '/api/schedule/220031-22') {
      return json({
        group_code: '220031-22',
        lessons: [
          {
            date: '2026-09-03',
            time: '09:40 - 11:10',
            subject: 'Программирование',
            lesson_type: 'лек.',
            room: 'Гл-401',
            teacher: 'Иванов И.И.',
          },
        ],
        fetched_at: '2026-07-29T10:00:00Z',
        is_stale: true,
        source_url: 'https://tulsu.ru/schedule/?search=220031-22',
      })
    }
    if (path === '/api/groups/group-1/tutors') {
      return json([
        {
          id: 'tutor',
          full_name: 'Анна Тьютор',
          vk_url: 'https://vk.ru/id1',
          description: 'Тьютор группы 220031-22',
          photo_url: null,
          valid_until: null,
        },
      ])
    }
    if (path === '/api/onboarding') {
      return json([
        {
          id: 'step',
          slug: 'choose-group',
          title: 'Выбрать группу',
          description: 'Сохраните основную группу.',
          action_path: '/schedule',
          sort_order: 0,
          completed: false,
        },
      ])
    }
    if (path === '/api/faq/categories') return json([])
    if (path === '/api/faq') return json([])
    if (path === '/api/assistant/query') {
      return json({
        type: 'answer',
        answer: {
          id: 'faq',
          question: 'Как найти своего тьютора?',
          answer_markdown: 'Выберите группу — приложение покажет тьютора.',
          category: 'Тьюторы',
          source_url: 'https://vk.ru/profburo_ipmkn_tsu',
          verified_at: '2026-07-29T00:00:00Z',
          is_time_sensitive: false,
        },
        message: 'Выберите группу — приложение покажет тьютора.',
        faq_ids: ['faq'],
        suggestions: [],
        confidence: 'high',
        sources: [],
        official_source: null,
        verified_at: '2026-07-29T00:00:00Z',
        mode: 'retrieval',
      })
    }
    if (path === '/api/resources') {
      return json([
        {
          id: 'resource-1',
          slug: 'tulsu-site',
          category: 'Важное',
          category_slug: 'important',
          title: 'Официальный сайт ТулГУ',
          url: 'https://tulsu.ru/',
          description: 'Документы и официальная информация университета.',
          icon: 'university',
          source_kind: 'official',
          contexts: ['catalog', 'about', 'official_info'],
        },
        {
          id: 'resource-2',
          slug: 'profburo-ipmkn',
          category: 'Студенческие сообщества',
          category_slug: 'student',
          title: 'Профбюро ИПМКН',
          url: 'https://vk.ru/profburo_ipmkn_tsu',
          description: 'Новости и объявления профбюро.',
          icon: 'community',
          source_kind: 'student',
          contexts: ['catalog', 'meeting'],
        },
        {
          id: 'resource-3',
          slug: 'event-community',
          category: 'Мероприятия',
          category_slug: 'events',
          title: 'Мероприятия ТулГУ',
          url: 'https://vk.ru/tulsu_event',
          description: 'Анонсы студенческих мероприятий.',
          icon: 'event',
          source_kind: 'student',
          contexts: ['catalog', 'events'],
        },
      ])
    }
    if (path === '/api/admin/dashboard') {
      return json({
        upcoming_events: 0,
        active_registrations: 0,
        registered_users: 0,
        cancelled_events: 0,
        recent_audit: 0,
      })
    }
    if (path === '/api/admin/faq') return json([])
    if (path === '/api/admin/users') return json([])
    if (path === '/api/admin/feedback') return json([])
    if (path === '/api/admin/events') {
      return request.method() === 'GET' ? json([]) : json({ id: 'event' }, 201)
    }
    if (path === '/api/campus/buildings') {
      return json([
        {
          id: 'main',
          slug: 'main',
          name: 'Главный учебный корпус ТулГУ',
          short_name: 'Главный',
          kind: 'academic',
          building_number: 'Главный',
          address: 'Тула, проспект Ленина, 92',
          entrance_hint: '',
          aliases: ['гл', 'главный'],
          complex_slug: 'main-9',
          dgis_url: 'https://2gis.ru/tula/geo/5067185235966202',
          dgis_object_id: '5067185235966202',
          dgis_complex_id: null,
          source_url: 'https://tulsu.ru/facilities/academic-building/4',
          latitude: null,
          longitude: null,
          sort_order: 0,
          verified_at: '2026-07-29T00:00:00Z',
          rooms: [],
        },
        {
          id: 'building-9',
          slug: 'building-9',
          name: 'Учебный корпус №9 ТулГУ',
          short_name: 'Корпус №9',
          kind: 'academic',
          building_number: '9',
          address: 'Тула, проспект Ленина, 92',
          entrance_hint: 'Вход через 9-й корпус.',
          aliases: ['9', '9к', '9 корпус'],
          complex_slug: 'main-9',
          dgis_url: 'https://2gis.ru/tula/geo/5067185235966202',
          dgis_object_id: '5067185235966202',
          dgis_complex_id: null,
          source_url: 'https://tulsu.ru/facilities/academic-building/8',
          latitude: null,
          longitude: null,
          sort_order: 9,
          verified_at: '2026-07-29T00:00:00Z',
          rooms: [],
        },
      ])
    }
    if (path === '/api/events') return json([])
    return json({})
  })
}

test('new student selects a group and sees the tutor', async ({ page }) => {
  await mockApi(page)
  await page.goto('/#/schedule')

  await page.locator('.schedule-group-picker__summary').click()
  await page.getByPlaceholder('Например, 220031-22').fill('220031-22')
  await page.getByRole('button', { name: 'Добавить группу 220031-22' }).click()
  await page
    .getByRole('button', { name: 'Открыть раздел «Ещё»' })
    .click()

  await expect(page.getByText('220031-22').last()).toBeVisible()
  await expect(page.getByText('Анна Тьютор')).toBeVisible()
})

test('home keeps a coherent dark surface and compact quick actions', async ({
  page,
}) => {
  await mockApi(page, [
    {
      id: 'group-1',
      code: '220031-22',
      academic_year: '2026/27',
      is_primary: true,
    },
  ])
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto('/?vk_color_scheme=client_dark#/')

  await expect(page.locator('.home-action')).toHaveCount(4)
  const surface = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    root: getComputedStyle(document.getElementById('root')!).backgroundColor,
    panel: getComputedStyle(
      document.querySelector('.vkuiPanel__in')!,
    ).backgroundColor,
    columns: getComputedStyle(
      document.querySelector('.home-actions')!,
    ).gridTemplateColumns,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    verticalOverflow:
      document.documentElement.scrollHeight > window.innerHeight,
  }))

  expect(surface.html).toBe('rgb(25, 25, 26)')
  expect(surface.body).toBe('rgb(25, 25, 26)')
  expect(surface.root).toBe('rgb(25, 25, 26)')
  expect(surface.panel).toBe('rgb(25, 25, 26)')
  expect(surface.columns.trim().split(/\s+/)).toHaveLength(2)
  expect(surface.overflow).toBe(false)
  expect(surface.verticalOverflow).toBe(true)

  await page.getByRole('button', { name: /Мой тьютор Контакт наставника/ }).click()
  await expect(page).toHaveURL(/#\/more$/)

  await page.goto('/?vk_color_scheme=light#/')
  const lightSurface = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    panel: getComputedStyle(
      document.querySelector('.vkuiPanel__in')!,
    ).backgroundColor,
  }))
  expect(lightSurface.html).toBe('rgb(243, 245, 248)')
  expect(lightSurface.body).toBe('rgb(243, 245, 248)')
  expect(lightSurface.panel).toBe('rgb(243, 245, 248)')
})

test('quick start stays accessible on an extreme narrow viewport', async ({
  page,
}) => {
  await mockApi(page, [
    {
      id: 'group-1',
      code: '220031-22',
      academic_year: '2026/27',
      is_primary: true,
    },
  ])
  await page.setViewportSize({ width: 280, height: 700 })
  await page.goto('/?vk_color_scheme=client_dark#/')

  const quickActions = [
    /Спросить помощника Ответы про учёбу и институт/,
    /Личный кабинет ЛК ТулГУ/,
    /Мой тьютор Контакт наставника/,
    /Полезные ссылки Сервисы и сообщества/,
  ]
  for (const name of quickActions) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }

  const layout = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.home-action')]
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      heights: cards.map((card) => card.getBoundingClientRect().height),
      columns: getComputedStyle(
        document.querySelector('.home-actions')!,
      ).gridTemplateColumns,
    }
  })

  expect(layout.overflow).toBe(false)
  expect(layout.columns.trim().split(/\s+/)).toHaveLength(2)
  expect(new Set(layout.heights).size).toBeGreaterThanOrEqual(1)

  const tutor = page.getByRole('button', {
    name: /Мой тьютор Контакт наставника/,
  })
  await tutor.focus()
  await expect(tutor).toBeFocused()
  await expect(tutor).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/more$/)
})

test('assistant handles a typo with a grounded answer', async ({ page }) => {
  await mockApi(page)
  await page.goto('/#/assistant')

  await page
    .getByPlaceholder('Например: как найти своего тьютора?')
    .fill('как наити тютора')
  await page.getByRole('button', { name: 'Отправить' }).click()

  const userMessage = page.locator('.chat-message--user')
  await expect(userMessage).toBeVisible()
  await expect(userMessage).toContainText('как наити тютора')
  await expect(
    page.getByText('Выберите группу — приложение покажет тьютора.'),
  ).toBeVisible()
  await expect(page.getByText('Источники', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Проверено:/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Полезно' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Не помогло' })).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Обратиться к тьютору' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Очистить историю' }).click()
  await expect(userMessage).toHaveCount(0)
})

test('resource directory has actionable categorized links', async ({ page }) => {
  await mockApi(page)
  await page.goto('/#/more')

  await page.getByRole('button', { name: /Полезные ссылки/ }).click()
  await expect(page).toHaveURL(/#\/resources$/)
  await expect(page.getByRole('heading', { name: 'Важное' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Официальный сайт ТулГУ/ }),
  ).toBeEnabled()
})

test('events use one timeline and keep unknown dates honest', async ({ page }) => {
  await mockApi(page)
  await page.goto('/#/events')

  await expect(
    page.getByText('Следующая дата уточняется', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Новых мероприятий пока нет.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Все' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Собрания' })).toHaveCount(0)
})

test('stale schedule and map fallback remain useful', async ({ page }) => {
  await mockApi(page, [
    {
      id: 'group-1',
      code: '220031-22',
      academic_year: '2026/27',
      is_primary: true,
    },
  ])
  await page.goto('/#/schedule')
  await expect(page.getByText('Показана сохранённая копия')).toBeVisible()
  await page.getByRole('link', { name: 'Гл-401' }).click()
  await expect(page).toHaveURL(/#\/map$/)
  await expect(
    page.getByText(/Главный и 9-й корпуса — одно здание/),
  ).toBeVisible()

  await expect(page.getByText(/нет координат или этажей/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть в 2ГИС' })).toBeEnabled()
})

test('admin build is isolated and keyboard focus is visible', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('http://127.0.0.1:4174/')

  await expect(page.getByText('Управление', { exact: true })).toBeVisible()
  await expect(page.getByText('Новое событие', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Главная' })).toHaveCount(0)

  const eventMode = page.getByRole('button', { name: 'Другое событие' })
  await eventMode.focus()
  await expect(eventMode).toBeFocused()
})
