# 🚀 Быстрая инструкция по деплою

## Шаг 1: Подготовка на вашем компьютере

1. **Убедитесь, что код собран и закоммичен:**
   ```bash
   git add .
   git commit -m "Готово к деплою"
   git push
   ```

## Шаг 2: Подключение к серверу

```bash
ssh user@your-server.com
```

## Шаг 3: Настройка сервера (первый раз)

```bash
# 1. Установите Node.js 18+ (если еще не установлен)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Установите PM2 глобально
sudo npm install -g pm2

# 3. Установите Nginx (если нужен веб-сервер)
sudo apt update
sudo apt install nginx
```

## Шаг 4: Загрузка кода на сервер

**Вариант A: Через Git (рекомендуется)**
```bash
cd /var/www
sudo mkdir -p jingai
sudo chown $USER:$USER jingai
cd jingai
git clone https://your-repo-url.git .
```

**Вариант B: Через SCP (если нет Git)**
```bash
# На вашем компьютере:
scp -r . user@your-server.com:/var/www/jingai/
```

## Шаг 5: Создание .env файла

```bash
cd /var/www/jingai/backend
nano .env
```

Вставьте следующий контент (замените значения на реальные):

```env
DATABASE_URL="file:./prisma/prod.db"
JWT_SECRET="сгенерируйте-безопасный-ключ-здесь"
NODE_ENV=production
PORT=4000
CORS_ORIGIN="https://yourdomain.com"
CORS_CREDENTIALS=true
FRONTEND_URL="https://yourdomain.com"
```

**Сгенерируйте JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Шаг 6: Автоматический деплой

```bash
cd /var/www/jingai
chmod +x deploy.sh
./deploy.sh
```

Скрипт автоматически выполнит все необходимые шаги!

## Шаг 7: Настройка Nginx (если используется)

```bash
# Скопируйте конфигурацию
sudo cp nginx.conf.example /etc/nginx/sites-available/jingai

# Отредактируйте (замените yourdomain.com на ваш домен)
sudo nano /etc/nginx/sites-available/jingai

# Активируйте конфигурацию
sudo ln -s /etc/nginx/sites-available/jingai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Настройте SSL (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Шаг 8: Проверка работоспособности

```bash
# Проверьте статус приложения
pm2 status

# Посмотрите логи
pm2 logs jingai-backend

# Проверьте API
curl http://localhost:4000/api/health
```

## Обновление приложения (для следующих деплоев)

```bash
cd /var/www/jingai
git pull
./deploy.sh
```

## Полезные команды PM2

```bash
pm2 status              # Статус приложения
pm2 logs jingai-backend # Логи
pm2 restart jingai-backend # Перезапуск
pm2 stop jingai-backend    # Остановка
pm2 monit               # Мониторинг в реальном времени
```

## Troubleshooting

**Приложение не запускается:**
```bash
pm2 logs jingai-backend --lines 50
```

**Ошибка с базой данных:**
```bash
cd backend
npm run prisma:migrate:deploy
```

**Порт уже занят:**
```bash
sudo lsof -i :4000
sudo kill -9 <PID>
```

**Проблемы с правами доступа:**
```bash
sudo chown -R $USER:$USER /var/www/jingai
```

