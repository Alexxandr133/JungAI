# Инструкция по обновлению Node.js на сервере

## Проблема
На сервере установлен Node.js 18.20.8, а Vite 7 требует Node.js 20.19+ или 22.12+.
Это вызывает проблемы со сборкой и работой React в проде.

## Решение: обновление Node.js до версии 20 LTS

### Шаг 1: Обновление Node.js через nvm (рекомендуется)

Если на сервере установлен `nvm`:

```bash
# Проверить текущую версию
node -v

# Установить Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Проверить версию
node -v  # Должно показать v20.x.x
npm -v
```

### Шаг 2: Обновление Node.js через пакетный менеджер (если нет nvm)

#### Для Ubuntu/Debian:

```bash
# Обновить список пакетов
apt update

# Установить Node.js 20 через NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Проверить версию
node -v  # Должно показать v20.x.x
npm -v
```

#### Для CentOS/RHEL:

```bash
# Установить Node.js 20 через NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Проверить версию
node -v  # Должно показать v20.x.x
npm -v
```

### Шаг 3: Переустановка зависимостей и пересборка

После обновления Node.js:

```bash
cd /var/www/jingai

# Удалить старые node_modules и lock файлы
rm -rf node_modules package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
rm -rf backend/node_modules backend/package-lock.json

# Установить зависимости заново
npm install

# Пересобрать фронтенд
cd frontend
npm install
npm run build

# Перезагрузить nginx
systemctl reload nginx
```

### Шаг 4: Проверка

```bash
# Проверить версию Node.js
node -v

# Проверить, что сборка прошла успешно
cd /var/www/jingai/frontend
npm run build

# Проверить логи nginx (если нужно)
tail -f /var/log/nginx/error.log
```

## Альтернатива: понижение версии Vite (не рекомендуется)

Если по каким-то причинам нельзя обновить Node.js, можно понизить версию Vite до 5.x,
которая поддерживает Node.js 18:

```bash
cd frontend
npm install vite@^5.4.0 @vitejs/plugin-react@^4.3.0 --save-dev
npm run build
```

Но лучше обновить Node.js до версии 20.

