# 🚀 Инструкция по деплою на сервер 212.193.30.213

## Быстрый способ (автоматический)

### Шаг 1: Подключись к серверу

```bash
ssh root@212.193.30.213
```

### Шаг 2: Выполни команды на сервере

```bash
# Скачай и выполни скрипт деплоя
curl -fsSL https://raw.githubusercontent.com/Alexxandr133/JungAI/main/deploy-to-server.sh | bash
```

**ИЛИ** если скрипт уже есть в репозитории:

```bash
cd /var/www
mkdir -p jingai
cd jingai
git clone https://github.com/Alexxandr133/JungAI.git .
chmod +x deploy-to-server.sh
./deploy-to-server.sh
```

---

## Ручной способ (пошагово)

### Шаг 1: Подключись к серверу

```bash
ssh root@212.193.30.213
```

### Шаг 2: Установи Node.js и PM2 (если ещё не установлены)

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# PM2
npm install -g pm2
```

### Шаг 3: Клонируй проект

```bash
cd /var/www
mkdir -p jingai
cd jingai
git clone https://github.com/Alexxandr133/JungAI.git .
```

### Шаг 4: Создай `.env` файл для backend

```bash
cd backend
nano .env
```

Вставь следующий контент (замени значения на свои):

```env
DATABASE_URL="file:./prisma/prod.db"
JWT_SECRET="сгенерируй-сложный-ключ-здесь"
NODE_ENV=production
PORT=4000
CORS_ORIGIN="http://212.193.30.213"
CORS_CREDENTIALS=true
FRONTEND_URL="http://212.193.30.213"
```

**Сгенерируй JWT_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Шаг 5: Запусти деплой

```bash
cd /var/www/jingai
chmod +x deploy.sh
./deploy.sh
```

### Шаг 6: Проверь, что всё работает

```bash
pm2 status
pm2 logs jingai-backend
curl http://localhost:4000/api/health
```

---

## Обновление проекта (после изменений)

### На своём компьютере:

```bash
git add .
git commit -m "описание изменений"
git push
```

### На сервере:

```bash
ssh root@212.193.30.213
cd /var/www/jingai
git pull
./deploy.sh
```

---

## Настройка Nginx (опционально, для веб-доступа)

Если хочешь, чтобы приложение было доступно по домену через порт 80/443:

```bash
# Установи Nginx
apt update
apt install -y nginx

# Скопируй конфигурацию
cp /var/www/jingai/nginx.conf.example /etc/nginx/sites-available/jingai

# Отредактируй (замени yourdomain.com на твой домен или IP)
nano /etc/nginx/sites-available/jingai

# Активируй конфигурацию
ln -s /etc/nginx/sites-available/jingai /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Troubleshooting

### Приложение не запускается

```bash
pm2 logs jingai-backend --lines 50
```

### Ошибка с базой данных

```bash
cd /var/www/jingai/backend
npm run prisma:migrate:deploy
```

### Порт уже занят

```bash
lsof -i :4000
kill -9 <PID>
```

### Проблемы с правами доступа

```bash
chown -R root:root /var/www/jingai
chmod -R 755 /var/www/jingai
```

---

## Полезные команды PM2

```bash
pm2 status              # Статус приложения
pm2 logs jingai-backend  # Логи
pm2 restart jingai-backend # Перезапуск
pm2 stop jingai-backend    # Остановка
pm2 monit               # Мониторинг в реальном времени
```

