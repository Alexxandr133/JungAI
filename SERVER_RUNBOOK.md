# Server Runbook (JingAI)

Короткая памятка по текущему прод-стенду: где что лежит, как деплоить, как поднимать видеозвонки и почему падала БД.

## 1) Текущая структура на сервере

- Код проекта: `/var/www/jingai`
- Backend: `/var/www/jingai/backend`
- Frontend: `/var/www/jingai/frontend`
- Рабочая SQLite БД (актуально): `/var/www/jingai/backend/prisma/prod.db`
- Uploads (аватары/верификации), откуда отдает backend:
  - `/var/www/jingai/backend/backend/uploads`
  - аватары: `/var/www/jingai/backend/backend/uploads/avatars`
- Локальные бэкапы БД:
  - `/var/backups/jingai`

## 2) Быстрые проверки после входа на сервер

```bash
cd /var/www/jingai
pm2 status
docker ps | grep livekit || true
grep '^DATABASE_URL=' /var/www/jingai/backend/.env
sqlite3 /var/www/jingai/backend/prisma/prod.db ".tables" | head
```

## 3) Безопасный деплой (чтобы не сломать БД)

```bash
cd /var/www/jingai
pm2 stop jingai-backend

# 1) Бэкап БД перед деплоем
mkdir -p /var/backups/jingai
sqlite3 /var/www/jingai/backend/prisma/prod.db ".backup '/var/backups/jingai/prod.db.pre_deploy.$(date +%F-%H%M%S).sqlite'"

# 2) Обновление кода
git stash push -u -m "server-temp-before-pull-$(date +%F-%H%M)" || true
git pull origin main

# 3) Зависимости (monorepo)
rm -rf node_modules backend/node_modules frontend/node_modules
npm ci --include=dev
cd /var/www/jingai/backend && npm ci --include=dev
cd /var/www/jingai/frontend && npm ci --include=dev

# 4) Генерация prisma + сборка
cd /var/www/jingai/backend
npx --no-install prisma generate
cd /var/www/jingai
npm run build:backend
npm run build:frontend

# 5) Запуск
pm2 restart jingai-backend --update-env
pm2 save
pm2 flush jingai-backend
pm2 logs jingai-backend --lines 80
```

### Важно

- На проде не запускать без необходимости:
  - `prisma migrate dev`
  - `prisma db push`
- `prisma migrate deploy` запускать только если точно понятны миграции и есть свежий бэкап БД.

## 4) Конфиг видеозвонков (LiveKit)

### 4.1 backend `.env`

Файл: `/var/www/jingai/backend/.env`

Минимум:

```env
DATABASE_URL="file:./prisma/prod.db"
LIVEKIT_URL=wss://meet.jung-ai.ru
LIVEKIT_API_KEY=prodkey
LIVEKIT_API_SECRET=<SECRET_32+>
LIVEKIT_TOKEN_TTL_SEC=3600
FRONTEND_URL=https://jung-ai.ru
```

### 4.2 Docker (LiveKit)

```bash
docker rm -f livekit 2>/dev/null || true
docker run -d --name livekit \
  --restart unless-stopped \
  -p 7880:7880 \
  -p 7881:7881/udp \
  -e LIVEKIT_KEYS="prodkey: <SECRET_32+>" \
  livekit/livekit-server

docker ps | grep livekit
docker logs livekit --tail 50
```

### 4.3 Nginx (`meet.jung-ai.ru`)

Нужен отдельный vhost reverse-proxy на `127.0.0.1:7880` с заголовками WebSocket:

- `Upgrade $http_upgrade`
- `Connection "upgrade"`

Проверка:

```bash
nginx -t
systemctl reload nginx
curl -I https://meet.jung-ai.ru
```

Если `cannot load certificate ... fullchain.pem`, значит SSL-сертификат не выпущен/не найден.
Временно сделать HTTP-конфиг, затем `certbot --nginx -d meet.jung-ai.ru`.

## 5) Что сломало БД ранее (и как не повторять)

### Что произошло

- В `.env` переключали `DATABASE_URL` на другой путь.
- Команда копирования была с `cp -an` (не перезаписывает файл), из-за этого остался старый/пустой файл `16K`.
- Backend подключился к неверной/пустой SQLite и падал с:
  - `Error code 14: Unable to open the database file`
  - `P2021 The table main.User does not exist`

### Как правильно

- Перед любыми изменениями всегда делать `.backup`.
- Для критичных копий использовать `cp -af`, а не `cp -an`.
- После каждого деплоя проверять:

```bash
ls -lah /var/www/jingai/backend/prisma/prod.db
sqlite3 /var/www/jingai/backend/prisma/prod.db "select count(*) from User;"
```

Если `User` не найдена — не запускать backend, сначала восстановить БД.

## 6) Восстановление аватаров (если пропали)

Backend отдает файлы из:

- `/var/www/jingai/backend/backend/uploads/avatars`

Если в БД ссылки есть, а файлов нет (404), докопировать из старых папок:

```bash
cp -an /var/www/jingai/backend/uploads/avatars/* /var/www/jingai/backend/backend/uploads/avatars/
pm2 restart jingai-backend --update-env
```

## 7) Рекомендуемые заметки на будущее

- Всегда хранить минимум 2-3 свежих бэкапа БД в `/var/backups/jingai`.
- После критичных работ сохранять backup локально (через `scp`).
- Не выполнять `git pull` без преддеплойного backup БД.
- После `pm2 flush` смотреть только свежие логи (старые ошибки часто вводят в заблуждение).
