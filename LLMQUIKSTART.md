# LLMQUIKSTART (JingAI)

Документ для быстрого восстановления контекста в новом чате с AI-ассистентом.
Цель: чтобы помощник сразу понимал архитектуру, зоны риска, роли, деплой, и типовые регрессии.

---

## 1) Что это за проект

JingAI — monorepo-платформа для психологов и клиентов:
- рабочая область психолога (клиенты, заметки, документы, сессии),
- социальный блок (публикации, сообщества, комментарии, лайки),
- AI-инструменты психолога (чаты, шорткаты, модальности),
- события/сессии и видеовстречи (LiveKit),
- гостевой вход в комнату по ссылке.

---

## 2) Технологический стек

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **DB**: SQLite + Prisma
- **Realtime/video**: LiveKit (SFU), WebSocket
- **Process manager**: PM2
- **Reverse proxy**: Nginx
- **SSL**: Certbot / Let's Encrypt

---

## 3) Структура репозитория

- `backend/` — API, Prisma, бизнес-логика
- `frontend/` — UI
- `shared/` — общие типы/утилиты
- `docker-compose.livekit.yml` — локальный/прод шаблон для LiveKit
- `LIVEKIT_LOCAL_TEST.md` — заметки по тестам LiveKit
- `SERVER_RUNBOOK.md` — серверный ранбук (деплой/аварийка)

Критичные файлы:
- `backend/prisma/schema.prisma`
- `backend/src/routes/events.ts`
- `backend/src/routes/community.ts`
- `backend/src/server.ts`
- `backend/src/config.ts`
- `frontend/src/pages/room/VoiceRoom.tsx`
- `frontend/src/pages/events/Events.tsx`
- `frontend/src/pages/client/Sessions.tsx`
- `frontend/src/main.tsx`

---

## 4) Роли и модель доступа

Основные роли:
- `admin`
- `psychologist`
- `researcher`
- `client`
- `guest` (для публичной ссылки в комнату, без аккаунта)

Ключевые правила:
- Психолог видит/управляет только своими клиентами/событиями.
- Публикация от имени сообщества разрешена только владельцу сообщества (или администратору).
- Гость может входить только в разрешенные типы комнат (video/call legacy-map).

---

## 5) Ключевые продуктовые блоки

### 5.1 Сессии/события
- Планирование встреч психологом.
- Клиент принимает/отклоняет приглашения.
- Разделение на актуальные и историю по `endsAt`.
- Выделение ближайшей встречи отдельно.

### 5.2 Видеовстречи (LiveKit)
- Комната: `/room/:roomId`
- Для авторизованных: токен через защищенный endpoint.
- Для гостя: публичный endpoint + ввод display name.
- Backend генерирует LiveKit token.

### 5.3 Сообщества/публикации
- Лента, комментарии, лайки.
- Постинг от сообщества строго по ownerId (исправлено ранее как критичная уязвимость).

### 5.4 AI
- AI чаты, папки, шорткаты.
- Настройки/персонализация AI психолога.
- Модальность (важно не смешивать школы терапии в промптах/контексте).

---

## 6) Текущее состояние видеовстреч (важный контекст)

Исправлялись UX-проблемы комнаты:
- стабильный размер tile при включении камеры,
- возврат аватара после выключения камеры,
- отключение пересортировки участников по голосу,
- подсветка говорящего зеленым,
- корректный fit аватара в рамке.

Главный фронтовый файл:
- `frontend/src/pages/room/VoiceRoom.tsx`

---

## 7) Прод-инфраструктура (фактическая)

- Сервер Linux + PM2 + Nginx
- Backend порт: `4000`
- LiveKit контейнер:
  - `7880/tcp` (HTTP/WS)
  - `7881/udp` (RTC)
- Домен приложения: `https://jung-ai.ru`
- Домен транспорта LiveKit: `https://meet.jung-ai.ru` (WSS endpoint через Nginx proxy)

Важно:
- UI встречи остается на `jung-ai.ru/room/:id`
- `meet.jung-ai.ru` — это транспортный endpoint LiveKit.

---

## 8) Критичные server/env параметры

`backend/.env` (минимум):
- `DATABASE_URL`
- `NODE_ENV=production`
- `PORT=4000`
- `FRONTEND_URL=https://jung-ai.ru`
- `LIVEKIT_URL=wss://meet.jung-ai.ru`
- `LIVEKIT_API_KEY=prodkey`
- `LIVEKIT_API_SECRET=<long_secret_32+>`
- `LIVEKIT_TOKEN_TTL_SEC=3600`

Правило:
- `LIVEKIT_API_SECRET` в backend `.env` должен совпадать 1:1 с `LIVEKIT_KEYS` в Docker-контейнере LiveKit.

---

## 9) БД: что было проблемным и как не повторять

### Что ломалось
- Backend подключался к неправильному/пустому SQLite файлу (часто 16KB).
- Симптомы:
  - `Prisma Error code 14: Unable to open database file`
  - `P2021 table main.User does not exist`
- Ошибка в операциях копирования: использование `cp -an` (не перезаписывает существующий файл).

### Жесткие правила
1. Перед деплоем всегда делать `.backup` SQLite.
2. Проверять таблицы и объем до рестарта backend:
   - `.tables`
   - `select count(*) from User;`
3. Не переключать `DATABASE_URL` без явной проверки файла.
4. Не запускать опасные миграции без свежего backup.

---

## 10) Uploads/аватары: отдельный риск

Были случаи 404 на аватары после восстановления.
Причина: в БД есть ссылки на `/uploads/avatars/...`, но сами файлы отсутствуют в целевой папке.

Проверять:
- где backend реально отдает статику uploads,
- есть ли соответствующие физические файлы.

---

## 11) Безопасный деплой (кратко)

1. `pm2 stop jingai-backend`
2. backup БД (`sqlite .backup`)
3. `git pull`
4. `npm ci` (root + workspaces при необходимости)
5. `npm -w backend run prisma:generate` из корня монорепо (**никогда** голый `npx prisma` — подтянется Prisma 7 и сломается схема)
6. `npm run build:backend && npm run build:frontend`
7. `pm2 restart jingai-backend --update-env`
8. `pm2 logs ...` (только свежие)

Не делать “на автомате”:
- `prisma db push`
- `prisma migrate dev`

---

## 12) Частые ошибки и быстрые причины

- `Cannot find module 'express'`
  - сломанные/неполные node_modules, workspace install не завершен.

- `Cannot find type definition file for 'vite/client'`
  - фронтовые devDependencies не установлены.

- `cannot load certificate ... fullchain.pem`
  - SSL путь указан в nginx до выпуска сертификата.

- `docker pull ... rate limit`
  - лимит Docker Hub для unauthenticated pull, нужен `docker login` или альтернативный registry.

---

## 13) Чек-лист “перед любым изменением”

- [ ] Есть свежий backup БД (локально на сервере + желательно скачан на ПК)
- [ ] Понятен актуальный `DATABASE_URL`
- [ ] Проверен размер и таблицы SQLite
- [ ] Зафиксирован текущий `LIVEKIT_API_SECRET`
- [ ] Понимание: меняем код, infra или оба

---

## 14) Чек-лист “после деплоя”

- [ ] `pm2 status` — backend online
- [ ] `pm2 logs` — без новых критичных ошибок
- [ ] `curl -I https://meet.jung-ai.ru` — отвечает
- [ ] логин клиента/психолога работает
- [ ] создание встречи + вход в комнату работает
- [ ] проверка гостевой ссылки в комнату работает

---

## 15) Важные продуктовые договоренности (исторически)

- Клиента после выхода из комнаты вести на клиентский экран, не на экран психолога.
- Неподтвержденные встречи не должны попадать в ближайшие.
- В истории показывать прошедшие по `endsAt` (или `startsAt`, если `endsAt` нет).
- Удален тип “звонок” из UI (legacy map к video при чтении старых данных).
- Публикации от сообщества только владельцем сообщества.

---

## 16) Что сообщать ассистенту в новом чате (рекомендуемый минимальный блок)

1. Где сейчас prod БД и ее размер.
2. Текущий `DATABASE_URL` из `.env`.
3. Статус LiveKit контейнера (`docker ps | grep livekit`).
4. Статус backend (`pm2 status`, свежие `pm2 logs`).
5. Что именно нужно сделать: код / деплой / инфраструктура / восстановление.

---

## 17) Принцип работы с этим документом

Если контекст в новом чате потерян:
- сначала дать ассистенту этот файл,
- затем добавить текущие свежие логи/ошибки,
- отдельно сформулировать цель (например: “только деплой без миграций и без риска БД”).

---

## 18) Оперативные заметки (2026-05-07)

### 18.1 Критично по SQLite на проде
- Рабочая прод-БД: `backend/prisma/prod.db` (не `dev.db`).
- На сервере был обнаружен пустой файл `backend/prisma/dev.db` (0 bytes), из-за чего `no such table: User`.
- Обязательная настройка в `backend/.env`:
  - `DATABASE_URL=file:/var/www/jingai/backend/prisma/prod.db`
- Перед любыми миграциями:
  - остановить backend,
  - сделать backup именно `prod.db`,
  - проверить `.tables` и `select count(*) from User;`.

### 18.2 AI / OpenRouter (platform-wide)
- Чаты психолога и клиента работают через OpenRouter (единая OpenAI-compatible интеграция).
- Модель по умолчанию задается платформенно через админку (`PlatformSetting` / `ai_model_default`), пользовательский выбор модели убран.
- Рекомендуемые env-переменные:
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_SITE_URL=https://jung-ai.ru`
  - `OPENROUTER_SITE_NAME=JungAI`
  - `AI_MODEL_DEFAULT=deepseek/deepseek-v4-flash`
  - `AI_ALLOWED_MODELS=...` (актуальный whitelist)
- `HF_TOKEN` лучше не использовать на проде, чтобы избежать неявного fallback.

### 18.3 Время событий (/events) и timezone
- Исправлен прод-сдвиг времени для `datetime-local` (когда 18:00 превращалось в 21:00).
- Добавлены env-параметры:
  - `APP_TIME_ZONE=Europe/Moscow`
  - `EVENT_TIMEZONE_OFFSET_MINUTES=180`
- После деплоя обязательно проверить создание встречи на 18:00 и отображение без сдвига.

### 18.4 Деплой-практика, подтвержденная на проде
- Безопасная последовательность:
  1. `pm2 stop jingai-backend`
  2. backup БД и backup `backend/uploads`
  3. `git pull --ff-only`
  4. `npm ci`
  5. `npm -w backend run prisma:generate`
  6. `npm -w backend run prisma:migrate:deploy`
  7. `npm run build:backend && npm run build:frontend`
  8. `pm2 restart jingai-backend --update-env`
- Фронт как статика после `build:frontend` отдельного restart обычно не требует.
- Нельзя использовать destructive git-команды (`git clean`, `reset --hard`) без необходимости: риск для runtime-файлов (uploads).

