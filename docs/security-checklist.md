# Security checklist

Реализовано:

- серверная HMAC-проверка VK launch params и срок их действия;
- opaque session в HttpOnly cookie, CSRF header для изменений;
- `SameSite=None; Secure` обязательно в production для VK web iframe;
- dev auth физически запрещён production-конфигурацией;
- RBAC на каждом admin endpoint и отдельный superadmin bootstrap;
- мягкое удаление, версии FAQ и аудит;
- allowlist внешних endpoints ТулГУ, таймаут, валидация и rate limit;
- Pydantic/URL validation и ограничения размеров;
- секреты исключены из `VITE_*`, Git и HTTP-логов;
- request ID, security headers, строгий CORS;
- уникальные ключи notification jobs и deliveries;
- PostgreSQL не публикует порт в production compose.

Перед публичным запуском:

- [ ] Повернуть все dev-ключи и проверить историю Git secret scanner.
- [ ] Ограничить MapGL-ключ production-доменом.
- [ ] Проверить CSP после выяснения полного списка origin VK/2ГИС.
- [ ] Провести dependency/container scan.
- [ ] Настроить внешний rate limit в Caddy/VPS: in-memory limiter не общий между
      несколькими API workers.
- [ ] Установить мониторинг 5xx, свободного места и срока сертификата.
- [ ] Провести ручной тест CSRF/session внутри VK web, iOS и Android.
- [ ] Утвердить retention и автоматическое удаление обезличенных query hints.
