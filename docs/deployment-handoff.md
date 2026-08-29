# Пакет передачи для развёртывания

Актуальный production-стек — Docker Compose: PostgreSQL 18, FastAPI, отдельный
worker, frontend на Caddy и внешний Caddy с автоматическим TLS. Nginx, Redis,
systemd и cron в проекте не используются.

## Что передать вне Git

В папке `handoff/` (она намеренно добавлена в `.gitignore`) формируется архив
`ipmkn-start-handoff-YYYYMMDD.zip`. Его нельзя отправлять в публичный чат,
issue или прикладывать к репозиторию: в нём находится копия текущего `.env`.
Передавайте архив через защищённое хранилище с ограниченным доступом.

В архив входят:

- `secrets/.env.current` — текущие настройки среды из рабочей папки;
- `secrets/.env.production.example` — полный production-шаблон без секретов;
- production-конфигурации Compose/Caddy и скрипты резервного копирования;
- `data/ipmkn-local-snapshot.sqlite3` — локальный SQLite-снимок, если он был
  создан в рабочем окружении;
- seeds и исходный DOCX с базой знаний.

Соберите пакет на Windows из корня репозитория:

```powershell
.\\infra\\prepare-handoff.ps1
```

Скрипт создаст `handoff/ipmkn-start-handoff-YYYYMMDD.zip` и рядом файл
контрольной суммы SHA-256.

Локальный SQLite-снимок не является заменой production PostgreSQL-дампу и может
содержать рабочие пользовательские данные. В PostgreSQL на новом VPS нужно
применить миграции и один раз выполнить `python -m app.seed`. Если на момент
передачи уже есть production-БД, её оператор обязан сделать свежий дамп через
`infra/backup.sh` и приложить его к защищённому каналу передачи.

## Перед первым запуском

Заполните в production `.env` домен, сильные уникальные `APP_SECRET_KEY` и
`POSTGRES_PASSWORD`, настройки VK и, при включении соответствующих функций,
ключ 2ГИС/OpenRouter. Не переносите development-секреты в production: секреты
VK, ранее передававшиеся в чате или использовавшиеся в dev, должны быть
перевыпущены. Проверяйте, что `DEV_AUTH_ENABLED=false`, `COOKIE_SECURE=true` и
`COOKIE_SAMESITE=none`.

Полный порядок запуска, проверки и отката — в `docs/deployment.md`.
