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
        user: {
          id: 'user',
          vk_user_id: 1,
          display_name: 'E2E',
          roles: ['superadmin'],
        },
      })
    }
    if (path === '/api/auth/me') {
      return json({
        id: 'user',
        vk_user_id: 1,
        display_name: 'E2E',
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
          code: 'Б260211',
          academic_year: '2026/27',
          is_primary: true,
        },
      ]
      return json(savedGroups[0])
    }
    if (path === '/api/schedule/groups') return json(['Б260211', 'Б260221'])
    if (path === '/api/schedule/%D0%91260211') {
      return json({
        group_code: 'Б260211',
        lessons: [],
        fetched_at: '2026-07-29T10:00:00Z',
        is_stale: true,
        source_url: 'https://tulsu.ru/schedule/?search=Б260211',
      })
    }
    if (path === '/api/groups/group-1/tutors') {
      return json([
        {
          id: 'tutor',
          full_name: 'Анна Тьютор',
          vk_url: 'https://vk.ru/id1',
          description: 'Тьютор группы Б260211',
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
        faq_ids: ['faq'],
        suggestions: [],
        confidence: 'high',
        sources: [],
        verified_at: '2026-07-29T00:00:00Z',
      })
    }
    if (path === '/api/resources') return json([])
    if (path === '/api/admin/dashboard') {
      return json({
        needs_review_faq: 50,
        upcoming_events: 0,
        failed_assistant_queries: 1,
        unconfirmed_series: 1,
        recent_audit: 0,
        open_issue_reports: 0,
      })
    }
    if (path === '/api/admin/faq') return json([])
    if (path === '/api/admin/events') return json({ id: 'event' }, 201)
    if (path === '/api/campus/buildings') {
      return json([
        {
          id: 'main',
          name: 'Главный учебный корпус ТулГУ',
          short_name: 'Главный',
          address: 'Тула, проспект Ленина, 92',
          entrance_hint: '',
          dgis_url: 'https://2gis.ru/tula/geo/5067185235966202',
          latitude: null,
          longitude: null,
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

  await page.getByPlaceholder('Начните вводить номер группы').fill('Б2602')
  await page.getByRole('button', { name: 'Выбрать' }).first().click()
  await page.getByRole('button', { name: 'Ещё' }).click()

  await expect(page.getByText('Б260211').last()).toBeVisible()
  await expect(page.getByText('Анна Тьютор')).toBeVisible()
})

test('assistant handles a typo with a grounded answer', async ({ page }) => {
  await mockApi(page)
  await page.goto('/#/assistant')

  await page
    .getByPlaceholder('Например: как найти своего тьютора?')
    .fill('как наити тютора')
  await page.getByRole('button', { name: 'Найти ответ' }).click()

  await expect(page.getByText('Как найти своего тьютора?')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Открыть источник' })).toBeVisible()
})

test('stale schedule and map fallback remain useful', async ({ page }) => {
  await mockApi(page, [
    {
      id: 'group-1',
      code: 'Б260211',
      academic_year: '2026/27',
      is_primary: true,
    },
  ])
  await page.goto('/#/schedule')
  await expect(page.getByText('Показана сохранённая копия')).toBeVisible()

  await page.goto('/#/map')
  await expect(page.getByText(/ключ 2ГИС не настроен/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть в 2ГИС' })).toBeEnabled()
})

test('admin creates a draft event and keyboard focus is visible', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/#/admin')

  await page.getByPlaceholder('Встреча с тьюторами').fill('Тестовая встреча')
  const dates = page.locator('input[type="datetime-local"]')
  await dates.nth(0).fill('2026-09-03T17:30')
  await dates.nth(1).fill('2026-09-03T18:30')
  await page.getByRole('button', { name: 'Сохранить черновик' }).click()
  await expect(page.getByText('Черновик сохранён')).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
})
