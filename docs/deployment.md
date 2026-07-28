# Production deployment

## Рекомендуемая схема

Один VPS с Linux, Docker Compose и публичным IPv4:

```text
VK -> HTTPS/Caddy -> frontend
                  -> /api -> FastAPI -> PostgreSQL
                                  \-> worker
```

SPA и API работают на одном origin, поэтому HttpOnly cookie не становится
third-party cookie. Минимум для MVP: 2 vCPU, 2–4 ГБ RAM, 20 ГБ SSD.

## DNS и первый запуск

1. Выберите домен, например `start.ipmkn.example.ru`.
2. Создайте DNS `A` на IPv4 VPS и, только если IPv6 настроен, `AAAA`.
3. Откройте входящие TCP 80/443 и UDP 443.
4. Скопируйте репозиторий на сервер, создайте `.env` вне Git.
5. Установите `APP_DOMAIN`, `APP_PUBLIC_URL=https://...`,
   `API_PUBLIC_URL=https://.../api`, тот же origin в `ALLOWED_ORIGINS`,
   `APP_ENV=production`, `DEV_AUTH_ENABLED=false`, `COOKIE_SECURE=true`,
   сильные `APP_SECRET_KEY` и `POSTGRES_PASSWORD`.
6. Запустите:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml exec api python -m app.seed
   docker compose -f docker-compose.prod.yml ps
   curl -fsS https://YOUR_DOMAIN/ready
   ```

Caddy автоматически получает и продлевает сертификат Let's Encrypt. Проверка:
`curl -Iv https://YOUR_DOMAIN` и внешний TLS scanner.

Seed запускается вручную при первом развёртывании: автоматический запуск при
каждом рестарте мог бы перезаписать редакторские изменения в FAQ.

## Обновление и rollback

Перед обновлением выполните `./infra/backup.sh`, затем:

```bash
git pull --ff-only
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Миграции выполняются до старта API и должны быть обратно совместимыми с
предыдущим frontend. Для rollback переключитесь на заранее записанный Git tag,
пересоберите сервисы. Откат схемы выполняйте только после отдельной проверки;
безопаснее восстановить проверенный dump через `./infra/restore.sh`.

Храните зашифрованные резервные копии вне VPS и регулярно проверяйте
восстановление на отдельной БД. Скрипт restore очищает текущую БД, поэтому его
нельзя запускать без выбранного проверенного dump и окна обслуживания.

## Альтернатива

Frontend можно опубликовать через VK Mini Apps Deploy, а API оставить на своём
HTTPS-домене. Тогда потребуются строгий CORS и отдельная проверка поведения
cookie в VK WebView. Для небольшой команды один origin через Caddy проще и
надёжнее.
