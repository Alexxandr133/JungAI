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
- In-memory заменён на Prisma (`Community`, `PublicationPost`, …) — подробности в **§21**.
- Маршруты: `/publications` (мои посты/сообщества), `/feed` (общая лента), `/publications/post/:id` (статья + комментарии).
- Постинг от сообщества — только owner/moderator; `authorMode`: `account` | `community`.
- Реакции на посты в UI убраны; комментарии только на странице полной публикации.

### 5.4 AI
- AI чаты, папки, шорткаты.
- Прикрепление файлов в чат (PDF/DOCX/изображения) — см. **§22**.
- Подстраница **Транскрибация** (аудио → текст в БД, файл не хранится) — см. **§22**.
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

---

## 19) Релиз 2026-05-14 — календарь, публичная запись, сессии, AI, документация

Кратко для ассистента: коммит на `main` с миграциями Prisma; на проде после `git pull` обязательны `prisma migrate deploy`, сборка backend и **frontend** (`frontend/dist`), перезапуск PM2.

### 19.1 Календарь и события (психолог)
- Расширен экран «События» (`frontend/src/pages/events/Events.tsx`): календарь, модалки, сценарии записи и шаринга.
- Публичная страница записи по ссылке календаря: `frontend/src/pages/events/PublicCalendarBookPage.tsx`, маршрут подключён в `frontend/src/main.tsx`.
- Утилиты календаря вынесены в `frontend/src/lib/eventsCalendarUtils.ts`: расчёт свободных окон и слотов; **шаг слота и минимальная длина свободного окна — одно правило** (фильтр сегментов и загрузка префов из `localStorage` выравнивают `minFreeSegmentMinutes` под `slotIntervalMinutes`; отдельное поле «мин. длина окна» в UI убрано).
- Backend: `backend/src/routes/events.ts` — API для публичной записи, статусов заявок, согласования психологом, самозаписи клиента; доработки писем в `backend/src/utils/email.ts` (в т.ч. оформление с логотипом через CID там, где это реализовано в этом релизе).

### 19.2 База данных (Prisma)
Новые миграции в репозитории (имена папок):
- `20260514120000_calendar_public_booking`
- `20260514200000_calendar_booking_status_fields`
- `20260515120000_event_client_requested_session` — флаг заявки клиента на сессию (`Event.clientRequestedSession`); психолог подтверждает клиентские инициированные встречи.

Схема: `backend/prisma/schema.prisma` (поля событий/записи согласованы с миграциями).

### 19.3 Клиент: сессии и запись
- `frontend/src/pages/client/Sessions.tsx` — доработки отображения и записи.
- `frontend/src/components/client/ClientSessionBookingModal.tsx` — модальное окно самозаписи на слот (интеграция с календарём/API).

### 19.4 AI психолога
- `frontend/src/pages/psychologist/AIChat.tsx` — режим «работа с клиентами»: подписи статуса **«включен» / «выключен»**; ref на флаг режима при отправке после `saveChats`, чтобы в запрос уходило актуальное `clientModeEnabled`.
- `frontend/src/lib/api.ts` — исправление: тело POST не должно опираться на `if (options.body)` (иначе при ложном значении тело не сериализовалось).
- `backend/src/routes/ai.ts` — `parsePsychologistClientModeEnabled` для надёжного разбора флага (в т.ч. строка `'false'`); обобщённый режим без данных клиентов явно ходит в OpenRouter; лог перед вызовом в general mode; тот же разбор для `POST /ai/psychologist/dream-scope-preview`.

### 19.5 Документация
- В репозитории добавлен `PLATFORM_USER_GUIDE.md` (пользовательский гайд по платформе).
- Этот файл (`LLMQUIKSTART.md`) дополнен секцией 19 для восстановления контекста релиза.

### 19.6 Напоминание по деплою этого релиза
- После `git pull`: `npm ci` → `npm -w backend run prisma:generate` → `npm -w backend run prisma:migrate:deploy` → **`npm run build:backend && npm run build:frontend`** → `pm2 restart jingai-backend --update-env`.
- Убедиться, что nginx отдаёт актуальный `frontend/dist` из каталога деплоя (или скопировать собранный фронт в свой `root`).

---

## 20) Релиз 2026-06-02 — клиенты (архив), каталог психологов, ИИ-чат, рабочая область

Кратко для ассистента: релиз на `main` с **двумя миграциями Prisma**; на проде обязательны backup `prod.db`, `prisma migrate deploy`, сборка backend **и** frontend. Коммиты: `98376ce` (основной), `04f1332` (fix tsc tags), `26139ab` (fix папок ИИ).

### 20.1 Git / коммиты

| Коммит | Содержание |
|--------|------------|
| `98376ce` | Основной релиз: CRM клиентов, админ-каталог, ИИ, рабочая область, 2 миграции, docs RKN/Gamma |
| `04f1332` | `fix(backend)`: `Prisma.JsonNull` для поля `tags` в `PATCH /clients/:id` — без этого `npm run build:backend` падает на tsc |
| `26139ab` | `fix(ai)`: папки ИИ — `updateMany` вместо `update`, фронт синхронизирует одну папку |

### 20.2 Миграции Prisma (обязательны на проде)

1. **`20260602160000_client_therapy_archive_fields`**
   - Модель `Client`: `age`, `city`, `tags` (Json), `therapyEndedAt` (DateTime?).
   - «Завершить терапию» = `therapyEndedAt` заполняется, клиент **не удаляется** с платформы.
   - Активные: `psychologistId` + `therapyEndedAt IS NULL`.
   - Архив: `psychologistId` + `therapyEndedAt IS NOT NULL`.

2. **`20260602180000_psychologist_catalog_ranking`**
   - Модель `User`: `catalogSortOrder` (Int, default 0), `catalogHidden` (Boolean, default false).
   - Миграция проставляет начальный порядок существующим психологам по `createdAt`.

Проверка после migrate:

```bash
sqlite3 backend/prisma/prod.db "PRAGMA table_info(Client);" | grep -E 'age|therapyEndedAt'
sqlite3 backend/prisma/prod.db "PRAGMA table_info(User);" | grep -E 'catalogSortOrder|catalogHidden'
```

### 20.3 Клиенты психолога (`/clients`)

**Backend** — `backend/src/routes/clients.ts`:
- `GET /api/clients?status=active|archived` (по умолчанию `active`).
- `POST /api/clients/:id/end-therapy` — завершить терапию (открепление).
- `POST /api/clients/:id/restore-therapy` — вернуть из архива.
- `PATCH /api/clients/:id` — имя, телефон, возраст, город, теги; **email и пароль нельзя**.
- `DELETE /api/clients/:id` для психолога теперь тоже завершает терапию (soft); полное удаление — только `admin`.
- `GET /clients/my-psychologist` — если `therapyEndedAt` задан, клиент не видит этого психолога (`THERAPY_ENDED`).

**Frontend** — `frontend/src/pages/clients/List.tsx`:
- Вкладки «Активные» / «Архив».
- Кнопка «Завершить терапию» с confirm; после успеха — переход в архив.
- «Изменить» — модалка редактирования карточки.
- **Важно:** `localStorage` (`clients.items`) может подмешивать старые записи без `therapyEndedAt` в активный список — в `load()` добавлена фильтрация по вкладке и обновление `therapyEndedAt` в localStorage при end-therapy.

**TypeScript / IDE:** после изменения `schema.prisma` локально нужен `npm -w backend run prisma:generate`. Красные подчёркивания в IDE при устаревшем Prisma Client — ложные, если `npm -w backend run build` проходит.

**PATCH tags:** для очистки тегов использовать `Prisma.JsonNull`, не `null` (иначе ошибка tsc).

### 20.4 Публичный каталог психологов

**Backend:**
- `GET /api/psychologists/public` — только `isVerified: true`, `catalogHidden: false`, сортировка `catalogSortOrder ASC`, `createdAt ASC`.
- `GET /api/psychologists/public/:id` — 404 если скрыт (`catalogHidden`).
- Статистика на главной (`/public/stats`) — считает только не скрытых.

**Админка:**
- Страница `/admin/psychologists-catalog` — `frontend/src/pages/admin/PsychologistsCatalog.tsx`.
- API: `GET/PUT /api/admin/psychologists-catalog`.
- Порядок: ↑↓, «Скрыть»/«Показать», «Сохранить порядок».
- Пункт меню админа и карточка на `/admin`.

### 20.5 ИИ-ассистент психолога

**Контекст** — `backend/src/routes/ai.ts`:
- Увеличены лимиты истории (`MAX_CONVERSATION_MESSAGES`, `MAX_HISTORY_MESSAGE_CHARS`, `MAX_TOTAL_HISTORY_CHARS`) — контекст «не обрывается» через 2 сообщения.

**Markdown** — `frontend/src/pages/psychologist/AIChat.tsx` + `AIChatMarkdown.css`:
- Ответы рендерятся через `react-markdown` + `remark-gfm` + `remark-breaks`.
- Таблицы с границами, зеброй; ширина bubble ~92% на десктопе.

**Копирование таблиц в рабочую область:**
- При копировании выделения с `<table>` в буфер кладётся `text/html` (не только markdown `| |`).

**Папки чатов (исчезали / P2025):**
- Симптом: `Failed to save folder`, Prisma `P2025` на `aIChatFolder.update`.
- Причина 1: фронт вызывал `saveFolders()` для **всех** папок из localStorage, в т.ч. с id, которых нет в БД.
- Причина 2: backend делал `update` по id без записи → P2025.
- Фикс (`26139ab`): backend `updateMany` → если 0 строк, `create`; фронт `saveFolders(newFolders, syncFolderId?)` — POST только изменённой папки.
- Upsert папок на backend: `POST /api/ai/psychologist/folders` с телом `{ id?, name }`.

**Сайдбар настроек ИИ:**
- Блок «Настройки режимов» сворачивается (стрелка ▴/▾), состояние в `localStorage` (`psychologist_ai_settings_panel_collapsed`).

### 20.6 Рабочая область (`/psychologist/work-area`)

**Файлы:** `WorkArea.tsx`, `WorkAreaEditor.css`.

- Тема только глобальная (`useAppearance`), локальная кнопка ☀️ убрана.
- Layout: `100vh`, скролл только в контенте; `key={activeTab}` — нет «протекания» текста между вкладками.
- Панель инструментов Word-like (группы, подписи).
- Таблицы: вставка через сетку 10×10 (Jira-style) в portal (`position: fixed`), ресайз столбцов `.wa-col-resizer`, контекстное меню (строка/столбец).
- Вставка из ИИ: `sanitizePastedRichHtml` на paste.
- Индикатор «Сохранение…» с фиксированной шириной — без скачка layout при autosave.

### 20.7 Прочее UI (тот же период разработки, в репозитории ранее)

- Админ: редиректы на `/admin`, компактный дашборд, метрики видео (`f9fe58b`).
- VoiceRoom: настройки камеры/мика в dropdown (`VoiceRoom.tsx`, `VoiceRoom.css`).
- Список психологов: «верефицирован» → «Верифицирован» (`guest/client PsychologistsList`, `PublicProfile`).

### 20.8 Документация в репозитории

- `docs/RKN_OPERATOR_NOTIFICATION.md` — черновик уведомления РКН для ИП.
- `docs/DATA_SECURITY_PRESENTATION_GAMMA.md` — текст презентации по безопасности (Gamma, до 10 слайдов).

### 20.9 Деплой на прод (подтверждённый сценарий, 2026-06-02)

```bash
cd /var/www/jingai
grep DATABASE_URL backend/.env   # prod.db, ~8MB, не пустой
pm2 stop jingai-backend

TS=$(date +%Y%m%d_%H%M%S)
mkdir -p /root/jingai-backups
sqlite3 backend/prisma/prod.db ".backup /root/jingai-backups/prod_${TS}.db"
cp -a backend/prisma/prod.db /root/jingai-backups/prod_${TS}.db.copy
tar -czf /root/jingai-backups/uploads_${TS}.tar.gz -C backend uploads

git pull --ff-only origin main
npm ci
npm -w backend run prisma:generate
npm -w backend run prisma:migrate:deploy
npm run build:backend && npm run build:frontend
pm2 restart jingai-backend --update-env
```

**Замечания с реального деплоя:**
- `sqlite3 ... ".backup ~/jingai-backups/..."` — **не работает** с `~` в пути; использовать абсолютный путь `/root/jingai-backups/...`.
- Первая сборка backend упала: `tags: null` в `clients.ts` → исправлено в `04f1332`.
- Фронт мог собраться, пока backend падал — на проде нужен повторный `build:backend` после pull `04f1332` и `26139ab`.
- `pm2 logs` error.log показывает **хвост файла** — старые P2025 до рестарта не значат, что ошибка актуальна. Проверка фикса папок: `grep updateMany backend/dist/routes/ai.js` или `pm2 flush` + тест в UI.

### 20.10 Чек-лист приёмки после деплоя

- [ ] Логин психолога / админа
- [ ] `/clients` — активные, «Завершить терапию», архив, «Вернуть в активные», «Изменить»
- [ ] `/psychologists` — порядок и скрытые (админ → каталог)
- [ ] `/admin/psychologists-catalog` — сохранение порядка
- [ ] ИИ — markdown/таблицы, папки (создать/переименовать без P2025 в свежих логах)
- [ ] Рабочая область — таблица, paste из ИИ, нет скачка при сохранении
- [ ] `sqlite3 prod.db "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3;"` — обе миграции `20260602*`

### 20.11 Известные нерелизные/фоновые ошибки в логах

- `LIMIT_FILE_SIZE` (multer) — загрузка документа верификации > лимита (~5 MB), не связано с этим релизом.

---

## 21) Publications + Communities (MVP, 2026-04-26)

Пересборка соц-блока: авторы — психологи/исследователи, публичные сообщества, лента в стиле соцсети.

### 21.1 Миграции Prisma

- `20260426122000_add_publications_communities_mvp` — `Community`, `CommunityMember`, `PublicationPost`, `PublicationComment`, `PublicationReaction`.
- `20260426123500_add_publication_post_image_url` — `PublicationPost.imageUrl`.
- `20260426125500_add_publication_post_author_mode` — `PublicationPost.authorMode` (`account` | `community`).

### 21.2 Backend (`backend/src/routes/community.ts`)

Основные endpoint’ы (префикс `/api`):
- `GET/POST /communities`, `GET /communities/:slug`, `PATCH /communities/:id`
- `POST /communities/:id/subscription` — подписка/отписка
- `GET /publications/feed` — лента (`communityId`, `authorId`)
- `GET /publications/discovery`, `GET /publications/me`
- `POST /publications/posts`, `PATCH /publications/posts/:id`, `POST .../publish`
- `GET /publications/posts/:id`, `POST .../comments`
- Публично (гость): `GET /public/publications/discovery`, `GET /public/publications/posts/:id`
- Legacy: `GET /community/feed|events|courses` — прокси/заглушки для старых клиентов

**Грабля:** `POST /publications/posts` → 500 `Unknown argument imageUrl` / `authorMode`, если на сервере не выполнен `prisma generate` после миграции. В роуте есть **fallback**: повторный `create` без неизвестных полей.

Создание сообществ/постов: роли `psychologist`, `researcher`, `admin`. Клиент — чтение.

### 21.3 Frontend

| Путь | Файл | Назначение |
|------|------|------------|
| `/publications` | `Publications.tsx` | Профиль, мои сообщества, composer, черновики/публикация |
| `/feed` | `Feed.tsx` | Общая лента, фильтры, авторы |
| `/publications/community/:slug` | `CommunityView.tsx` | Шапка (cover+avatar), лента сообщества, подписчики, inline-управление |
| `/publications/community/:id/manage` | `CommunityManage.tsx` | Расширенное управление |
| `/publications/post/:id` | `PostView.tsx` | Полная статья + комментарии (единственное место для комментариев) |

Навигация: в `PsychologistNavbar` / `ResearcherNavbar` выпадающий пункт **«Сообщества»** → Публикации / Лента.

UX-решения:
- Карточки сообществ с `avatar`/`cover`; кнопка «Создать сообщество» — отдельный dashed-блок.
- Посты с `imageUrl` (часто data URL из FileReader, без отдельного upload-endpoint).
- Реакции на посты в UI скрыты; в ленте нет формы комментария.
- Черновики: `status` draft → `POST .../publish`.
- Rich composer: `PublicationComposer.tsx` (contentEditable + toolbar).

Seed: `backend/src/seed.ts` — демо-сообщества и стартовый пост.

---

## 22) ИИ-чат: вложения + транскрибация (2026-06-02, отладка локально)

**Статус:** отлажено локально; релиз на прод — §22.5 (миграции Prisma, `ffmpeg-static`, переменные `.env`).

### 22.1 Prisma / БД

**Новая миграция (только эта фича):**

| Миграция | Модель | Назначение |
|----------|--------|------------|
| `20260602190000_ai_transcriptions` | `AITranscription` | Таблица транскрибаций |
| `20260604120000_ai_transcription_status` | `AITranscription` | `status`, `progressPercent`, `progressStage`, `errorMessage` (фоновая обработка) |

Поля `AITranscription`:
- `psychologistId`, `title`, `sourceFileName`, `text`
- `language?`, `durationSec?`
- `status` — `processing` | `completed` | `failed`
- `progressPercent`, `progressStage?`, `errorMessage?`
- `createdAt`, `updatedAt`
- Индекс: `(psychologistId, createdAt)`

**Схема:** `backend/prisma/schema.prisma` (блок после `AIChatShortcut`).

**Зависимости backend (npm):** `pdf-parse` (v2, класс `PDFParse`), `mammoth` — вложения PDF/DOCX; **`ffmpeg-static`** — нарезка длинного аудио на сервере (бинарник в `node_modules`, в PATH системы ffmpeg не нужен).

**Локально уже выполнено (2026-06-02):**
```bash
cd backend
npx prisma generate
npm run prisma:migrate:deploy
```
- Применена миграция `20260602190000_ai_transcriptions` на **`backend/prisma/prisma/dev.db`** (путь из `DATABASE_URL` в `backend/.env`).
- После `prisma generate` перезапустить backend dev-сервер.

**На проде (до деплоя):** обе миграции `20260602190000_*` и `20260604120000_*` нужно применить через `prisma migrate deploy`.

### 22.2 Прикрепление файлов в ИИ-чат

**Файлы:**
- `backend/src/utils/aiChatAttachments.ts` — парсинг, in-memory store по `attachmentId` (TTL 1 ч), vision/STT-хелперы
- `backend/src/routes/ai.ts` — `POST /api/ai/psychologist/attachments`, поле `attachmentIds` в `POST /api/ai/psychologist/chat`
- `frontend/src/pages/psychologist/AIChat.tsx` — кнопка 📎 (lucide `Paperclip`), чипы файлов, Ctrl+V для фото
- `frontend/src/pages/psychologist/AIChatMarkdown.css` — `.ai-chat-attach-btn` (сброс глобального `padding` у `button`)

**Форматы:** PDF, DOCX, TXT, JPG/PNG/WEBP/GIF; до 5 файлов × 8 МБ.

**Поток:** multipart upload → парсинг на сервере → в чат уходят только `attachmentIds` (не base64 в JSON, лимит `express.json` 1 MB не бьёт).

**PDF:** `pdf-parse` v2 — **`PDFParse`**, не `require('pdf-parse')()` как функция (иначе `pdfParse is not a function`).

**Изображения:** при несовместимой платформенной модели автопереключение на vision-модель (`AI_VISION_MODEL`, по умолчанию `openai/gpt-4o-mini`); в `.env` опционально:
```env
AI_VISION_MODEL=openai/gpt-4o-mini
```

### 22.3 Транскрибация (подстраница ИИ)

**UI:** кнопка **«Транскрибация»** в шапке AI-чата (перед «Инфо» и шестерёнкой) → экран `aiScreen === 'transcription'`, возврат кнопкой «Чат».

**Файлы:**
- `frontend/src/pages/psychologist/AITranscriptionPanel.tsx` + `AITranscriptionPanel.css`
- `backend/src/services/audioTranscription.ts`, `audioChunking.ts`, `transcriptionJob.ts` — STT + ffmpeg + фоновые задачи
- `backend/src/repositories/aiTranscriptionRepository.ts`
- `backend/src/routes/ai.ts` — CRUD транскрибаций
- `frontend/src/pages/psychologist/transcriptionStorage.ts` — опрос статуса после перезагрузки страницы

**API (префикс `/api`, роли psychologist/admin + verification):**
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/ai/psychologist/transcriptions` | Список (до 200, новые сверху) |
| POST | `/ai/psychologist/transcriptions` | multipart `audio` → **202**, фоновая транскрибация (`processing` → `completed`) |
| GET | `/ai/psychologist/transcriptions/:id` | Статус одной задачи (опрос прогресса) |
| PATCH | `/ai/psychologist/transcriptions/:id` | JSON `{ "title": "..." }` — переименовать (до 200 символов) |
| DELETE | `/ai/psychologist/transcriptions/:id` | Удалить запись |

**STT (по умолчанию `chat-first`):** Gemini/OpenRouter `input_audio`; запасной STT endpoint. Длинные файлы режутся **`ffmpeg-static`** (части по **`AI_TRANSCRIPTION_CHUNK_SEC`**, по умолчанию **600 с**). **`AI_TRANSCRIPTION_MAX_MB=0`** — без лимита (практически до 4 ГБ на запрос). Список API отдаёт только **`completed`**; идущая работа — в UI зоны загрузки + опрос `GET .../:id`.

**`.env` на проде — добавить в `backend/.env` (не коммитить!):**
```env
# Транскрибация (OpenRouter — ключ уже должен быть)
AI_TRANSCRIPTION_STRATEGY=chat-first
AI_TRANSCRIPTION_CHAT_MODEL=google/gemini-2.5-flash
AI_TRANSCRIPTION_LANGUAGE=ru
AI_TRANSCRIPTION_MAX_MB=0
AI_TRANSCRIPTION_CHUNK_MB=8
AI_TRANSCRIPTION_CHUNK_SEC=600
AI_TRANSCRIPTION_DIARIZE=true
AI_TRANSCRIPTION_REFINE_MODEL=google/gemini-2.5-flash
AI_TRANSCRIPTION_STALE_MIN=25

# Вложения в ИИ-чат (если ещё нет)
AI_VISION_MODEL=openai/gpt-4o-mini
```

**Спикеры:** при `AI_TRANSCRIPTION_DIARIZE=true` (по умолчанию) модель помечает реплики «Спикер 1:», «Спикер 2:»…; для записей из нескольких ffmpeg-частей — дополнительный текстовый проход *refine* выравнивает метки на стыках. Отключить: `AI_TRANSCRIPTION_DIARIZE=false`.

`stt-first` — сначала классический STT endpoint. Проверка баланса: https://openrouter.ai/credits

**Квота:** списание через `consumeAiTokens` по длине текста транскрипта.

**config:** `backend/src/config.ts` — `aiVisionModel`, `aiTranscriptionChatModels`, `aiTranscriptionModels`.

### 22.4 Чек-лист локальной отладки

- [ ] `prisma generate` + `prisma:migrate:deploy` на dev.db
- [ ] Перезапуск `npm -w backend run dev`
- [ ] ИИ-чат: PDF/DOCX/фото в сообщении
- [ ] Транскрибация: загрузка MP3/WAV, текст в списке, копирование, удаление
- [ ] `OPENROUTER_API_KEY` задан в `backend/.env`

### 22.5 Деплой на прод (ИИ-вложения + транскрибация)

**Полный сценарий** — расширение §20.9. Перед деплоем: коммит на `main` с миграциями и `package-lock.json` (в т.ч. `ffmpeg-static`).

**1) На сервере — backup и pull:**
```bash
cd /var/www/jingai
grep DATABASE_URL backend/.env    # должно быть prod.db, файл не пустой
pm2 stop jingai-backend

TS=$(date +%Y%m%d_%H%M%S)
mkdir -p /root/jingai-backups
sqlite3 backend/prisma/prod.db ".backup /root/jingai-backups/prod_${TS}.db"
cp -a backend/prisma/prod.db /root/jingai-backups/prod_${TS}.db.copy

git pull --ff-only origin main
```

**2) Зависимости (обязательно `npm ci` — подтянет `ffmpeg-static`):**
```bash
npm ci
```

**3) Prisma (две миграции транскрибации + generate):**
```bash
npm -w backend run prisma:generate
npm -w backend run prisma:migrate:deploy
```

Ожидаемые новые миграции:
- `20260602190000_ai_transcriptions`
- `20260604120000_ai_transcription_status`

**4) Переменные `backend/.env` на сервере** — вручную дописать блок из §22.3 (`AI_TRANSCRIPTION_*`, `AI_VISION_MODEL`). Файл **не в git**. После правок: `pm2 restart jingai-backend --update-env`.

**5) Сборка и запуск:**
```bash
npm run build:backend && npm run build:frontend
pm2 restart jingai-backend --update-env
pm2 logs jingai-backend --lines 80
```

**6) Проверка БД:**
```bash
sqlite3 backend/prisma/prod.db "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%transcription%';"
sqlite3 backend/prisma/prod.db ".schema AITranscription"
```

**7) Проверка ffmpeg (опционально):**
```bash
ls -la backend/node_modules/ffmpeg-static/ffmpeg 2>/dev/null || ls backend/node_modules/ffmpeg-static/
```
Системный `ffmpeg` не обязателен — используется бинарник из пакета.

### 22.6 Приёмка после деплоя

- [ ] ИИ-чат: PDF/DOCX/фото, vision
- [ ] Транскрибация: загрузка → прогресс в зоне файла (не в списке) → готовая запись в списке → модалка по клику
- [ ] Переименование (PATCH), удаление
- [ ] Длинный файл (если есть): в логах `[STT] audio split` с несколькими частями
- [ ] `OPENROUTER_API_KEY` и квота OpenRouter

