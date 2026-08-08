# ИПМКН Старт

VK Mini App тьюторского сообщества ИПМКН ТулГУ для первокурсников. Это
неофициальный сервис: он объединяет расписание, маршрут первокурсника,
тьюторов, события, карту, проверенную базу ответов и полезные ссылки. Основная
группа выбирается на главной; соответствующий шаг маршрута отмечается автоматически.

## Быстрый запуск

Понадобятся Docker Desktop с Compose либо Python 3.12 + Node.js 24 + pnpm 11.

```bash
cp .env.example .env
docker compose up --build
```

После запуска:

- browser/dev режим: `http://localhost:5173`;
- API и OpenAPI: `http://localhost:8000/api/docs`;
- health: `http://localhost:8000/health`.

API при старте применяет миграции. Seed можно запустить повторно без дублей:

```bash
docker compose exec api python -m app.seed
```

Локальный browser adapter работает только при `APP_ENV=development|test` и
`DEV_AUTH_ENABLED=true`. В production такая комбинация запрещена конфигурацией.

## Запуск без Docker

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m app.seed
.venv/Scripts/uvicorn app.main:app --reload
```

Во втором терминале:

```bash
pnpm install --frozen-lockfile
pnpm frontend:dev
```

На Linux/macOS используйте `.venv/bin/...` вместо `.venv/Scripts/...`.

## Проверки

```bash
cd backend
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m pytest -q

cd ..
pnpm frontend:lint
pnpm frontend:test
pnpm frontend:build
pnpm frontend:e2e
```

## Данные

Нормализованный FAQ seed хранится в
`backend/app/knowledge/seed/faq.json`. Повторный импорт исходного DOCX:

```bash
cd backend
.venv/Scripts/python -m app.knowledge.importer ../Baza_voprosov_itog.docx \
  --output app/knowledge/seed/faq.json
.venv/Scripts/python -m app.knowledge.seed
```

Тьюторы импортируются из UTF-8 CSV по шаблону `backend/examples/tutors.csv`.
Новые тьюторы получают `needs_review` до публикации редактором.

## Конфигурация и документация

Секреты хранятся только в `.env`, который игнорируется Git. В `VITE_*`
разрешены только публичные значения. Все доступные переменные перечислены в
`.env.example`.

- архитектура: `docs/architecture.md`;
- настройка VK: `docs/vk-setup.md`;
- расписание: `docs/tulsu-schedule-integration.md`;
- 2ГИС: `docs/2gis-setup.md`;
- администрирование: `docs/admin-guide.md`;
- production/HTTPS: `docs/deployment.md`;
- приватность и релиз: `docs/privacy-checklist.md`,
  `docs/release-checklist.md`;
- security hardening: `docs/security-checklist.md`.
