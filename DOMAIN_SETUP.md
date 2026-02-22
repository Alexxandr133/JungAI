# 🌐 Настройка домена jung-ai.ru

## Шаг 1: Обновление переменных окружения на сервере

```bash
# Подключитесь к серверу
ssh user@212.193.30.213

# Перейдите в директорию проекта
cd /var/www/jingai/backend

# Отредактируйте .env файл
nano .env
```

Обновите следующие переменные:

```env
# ВАЖНО: Включите и IP, и домен, чтобы работать с обоими вариантами
# Пока домен не работает, используйте IP
CORS_ORIGIN="http://212.193.30.213,http://jung-ai.ru,https://jung-ai.ru"
CORS_CREDENTIALS=true
FRONTEND_URL="http://212.193.30.213"
```

**Важно:** 
- Пока домен `jung-ai.ru` не работает, используйте IP `212.193.30.213`
- После настройки SSL и проверки работы домена, можно будет изменить `FRONTEND_URL` на `https://jung-ai.ru`
- `CORS_ORIGIN` должен включать все варианты доступа (IP и домен)

## Шаг 2: Установка и настройка Nginx

```bash
# Установите nginx (если еще не установлен)
sudo apt update
sudo apt install nginx -y

# Проверьте статус
sudo systemctl status nginx
```

## Шаг 3: Копирование конфигурации Nginx

```bash
# Скопируйте конфигурацию из проекта
sudo cp /var/www/jingai/nginx-jung-ai.conf /etc/nginx/sites-available/jung-ai

# Или создайте файл вручную
sudo nano /etc/nginx/sites-available/jung-ai
```

Вставьте содержимое из файла `nginx-jung-ai.conf` (уже создан в проекте).

## Шаг 4: Активация конфигурации

```bash
# Создайте симлинк
sudo ln -s /etc/nginx/sites-available/jung-ai /etc/nginx/sites-enabled/

# Удалите дефолтную конфигурацию (если есть)
sudo rm /etc/nginx/sites-enabled/default

# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите nginx
sudo systemctl reload nginx
```

## Шаг 5: Настройка SSL (Let's Encrypt) - РЕКОМЕНДУЕТСЯ

```bash
# Установите certbot
sudo apt install certbot python3-certbot-nginx -y

# Получите SSL сертификат (certbot автоматически обновит конфигурацию nginx)
sudo certbot --nginx -d jung-ai.ru -d www.jung-ai.ru

# Следуйте инструкциям certbot:
# - Введите email для уведомлений
# - Согласитесь с условиями
# - Выберите редирект с HTTP на HTTPS (рекомендуется вариант 2)
```

После получения сертификата:

1. Обновите `.env` файл, заменив `http://` на `https://`:
```bash
cd /var/www/jingai/backend
nano .env
```

```env
CORS_ORIGIN="https://jung-ai.ru"
FRONTEND_URL="https://jung-ai.ru"
```

2. Перезапустите backend:
```bash
pm2 restart jingai-backend
```

3. Раскомментируйте HTTPS блок в `/etc/nginx/sites-available/jung-ai` и закомментируйте HTTP блок

4. Перезагрузите nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 6: Проверка работы

1. Откройте в браузере: `http://jung-ai.ru` (или `https://jung-ai.ru` после настройки SSL)
2. Проверьте, что сайт загружается
3. Проверьте API: `http://jung-ai.ru/api/health` (должен вернуть `{"status":"ok"}`)

## Шаг 7: Автоматическое обновление SSL (опционально)

Certbot автоматически настроит обновление сертификата. Проверить можно командой:

```bash
sudo certbot renew --dry-run
```

## Troubleshooting

### Проблема: 502 Bad Gateway
- Проверьте, что backend запущен: `pm2 status`
- Проверьте логи: `pm2 logs jingai-backend`
- Проверьте, что backend слушает на порту 4000: `sudo netstat -tlnp | grep 4000`

### Проблема: CORS ошибки
- Убедитесь, что в `.env` правильный `CORS_ORIGIN`
- Перезапустите backend: `pm2 restart jingai-backend`
- Проверьте логи: `pm2 logs jingai-backend`

### Проблема: Статические файлы не загружаются
- Проверьте права доступа: `sudo chown -R www-data:www-data /var/www/jingai/frontend/dist`
- Проверьте, что директория существует: `ls -la /var/www/jingai/frontend/dist`

### Проблема: Nginx не запускается
- Проверьте синтаксис: `sudo nginx -t`
- Проверьте логи: `sudo tail -f /var/log/nginx/error.log`

## Полезные команды

```bash
# Проверка статуса nginx
sudo systemctl status nginx

# Перезапуск nginx
sudo systemctl restart nginx

# Просмотр логов nginx
sudo tail -f /var/log/nginx/jung-ai-access.log
sudo tail -f /var/log/nginx/jung-ai-error.log

# Проверка портов
sudo netstat -tlnp | grep -E ':(80|443|4000)'

# Проверка DNS
nslookup jung-ai.ru
dig jung-ai.ru
```

