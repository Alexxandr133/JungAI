# LiveKit Local Test (JungAI)

## 1) Запустить LiveKit локально

Из корня проекта:

```bash
docker compose -f docker-compose.livekit.yml up -d
docker ps
```

Ожидаемо: контейнер `jingai-livekit` в статусе `Up`.

## 2) Подготовить backend env

Открой `backend/.env` и добавь:

```env
LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=supersecret
LIVEKIT_TOKEN_TTL_SEC=3600
```

Если не хочешь править вручную — можешь взять значения из `backend/.env.livekit.local.example`.

## 3) Запустить backend и frontend

В двух терминалах:

```bash
# терминал 1
npm run dev:backend
```

```bash
# терминал 2
npm run dev:frontend
```

## 4) Проверить, что токен выдается

Открой в браузере платформу, зайди под пользователем, у которого есть доступ к событию/комнате.
Перейди в комнату `/room/:roomId` через интерфейс событий.

Когда нажмешь "Присоединиться к встрече":
- frontend запрашивает `GET /api/events/room/:roomId/livekit-token`
- backend возвращает `token` + `url`
- происходит подключение к LiveKit.

## 5) Быстрый smoke test на 2 участника

1. Открой комнату в обычном окне браузера (психолог).
2. Открой ту же комнату в режиме инкогнито/другом браузере (клиент).
3. Разреши камеру и микрофон у обоих.
4. Проверь, что:
   - оба участника видят друг друга;
   - звук двусторонний;
   - выход из комнаты работает.

## 6) Остановить локальный LiveKit

```bash
docker compose -f docker-compose.livekit.yml down
```

---

## Важно

- Это локальный `--dev` режим LiveKit для теста.
- Для production нужен `wss://` (TLS), нормальный конфиг и секреты не из примера.
