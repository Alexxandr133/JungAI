# 🔒 Настройка SSL сертификата (Let's Encrypt)

## Шаг 1: Установка Certbot

Подключитесь к серверу и установите Certbot:

```bash
# Подключитесь к серверу
ssh user@212.193.30.213

# Обновите пакеты
sudo apt update

# Установите Certbot и плагин для Nginx
sudo apt install certbot python3-certbot-nginx -y
```

## Шаг 2: Получение SSL сертификата

Certbot автоматически настроит Nginx для вас:

```bash
# Получите сертификат для домена (Certbot автоматически обновит Nginx конфигурацию)
sudo certbot --nginx -d jung-ai.ru -d www.jung-ai.ru

# Или в интерактивном режиме (рекомендуется для первого раза)
sudo certbot --nginx
```

**Важно:** 
- Certbot попросит указать email для уведомлений о продлении
- Выберите, перенаправлять ли HTTP на HTTPS (рекомендуется выбрать "2" - Redirect)
- Certbot автоматически обновит конфигурацию Nginx

## Шаг 3: Проверка конфигурации

```bash
# Проверьте конфигурацию Nginx
sudo nginx -t

# Если всё ок, перезагрузите Nginx
sudo systemctl reload nginx
```

## Шаг 4: Проверка SSL

```bash
# Проверьте, что сертификат получен
sudo certbot certificates

# Проверьте доступность HTTPS
curl -I https://jung-ai.ru
```

## Шаг 5: Автоматическое продление

Certbot автоматически настроит cron-задачу для продления сертификата. Проверьте:

```bash
# Проверьте, что автообновление настроено
sudo systemctl status certbot.timer

# Или проверьте cron
sudo crontab -l | grep certbot
```

Сертификат Let's Encrypt действителен 90 дней и автоматически продлевается за 30 дней до истечения.

## Шаг 6: Обновление переменных окружения

После настройки SSL обновите `.env` файл на сервере:

```bash
cd /var/www/jingai/backend
nano .env
```

Обновите переменные:

```env
CORS_ORIGIN="https://jung-ai.ru,https://www.jung-ai.ru,http://212.193.30.213"
CORS_CREDENTIALS=true
FRONTEND_URL="https://jung-ai.ru"
```

Перезапустите backend:

```bash
cd /var/www/jingai/backend
pm2 restart all
```

## Шаг 7: Обновление конфигурации Nginx (если нужно вручную)

Если Certbot не обновил конфигурацию автоматически, раскомментируйте HTTPS секцию в `/etc/nginx/sites-available/jung-ai`:

```bash
sudo nano /etc/nginx/sites-available/jung-ai
```

Раскомментируйте блок `server` для HTTPS (строки 97-174) и раскомментируйте редирект в HTTP блоке (строка 13).

## Проверка работы

1. Откройте в браузере: `https://jung-ai.ru`
2. Проверьте, что есть зелёный замочек 🔒
3. Проверьте, что HTTP автоматически перенаправляет на HTTPS

## Возможные проблемы

### Проблема: Certbot не может получить сертификат

**Решение:**
- Убедитесь, что домен `jung-ai.ru` правильно резолвится на IP сервера
- Проверьте, что порт 80 открыт в firewall: `sudo ufw allow 80`
- Убедитесь, что Nginx работает: `sudo systemctl status nginx`

### Проблема: Ошибка "Too many certificates already issued"

**Решение:**
- Let's Encrypt имеет лимит на количество сертификатов для домена (50 в неделю)
- Подождите или используйте существующий сертификат

### Проблема: Сертификат не продлевается автоматически

**Решение:**
```bash
# Проверьте статус таймера
sudo systemctl status certbot.timer

# Включите таймер, если он отключен
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Или добавьте в cron вручную
sudo crontab -e
# Добавьте строку:
# 0 0,12 * * * certbot renew --quiet
```

## Тестирование продления

```bash
# Протестируйте продление (не обновляет реальный сертификат)
sudo certbot renew --dry-run
```

Если тест проходит успешно, автоматическое продление настроено правильно.

