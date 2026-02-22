#!/bin/bash

# Скрипт для настройки SSL сертификата Let's Encrypt
# Запустите на сервере: sudo bash setup-ssl.sh

set -e

echo "🔒 Настройка SSL для jung-ai.ru"
echo ""

# Проверка, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Пожалуйста, запустите скрипт с sudo"
    exit 1
fi

# Обновление пакетов
echo "📦 Обновление пакетов..."
apt update

# Установка Certbot
echo "📦 Установка Certbot..."
apt install -y certbot python3-certbot-nginx

# Проверка, что Nginx работает
echo "🔍 Проверка Nginx..."
if ! systemctl is-active --quiet nginx; then
    echo "⚠️  Nginx не запущен. Запускаю..."
    systemctl start nginx
fi

# Проверка конфигурации Nginx
echo "🔍 Проверка конфигурации Nginx..."
if ! nginx -t; then
    echo "❌ Ошибка в конфигурации Nginx. Исправьте перед продолжением."
    exit 1
fi

# Получение сертификата
echo ""
echo "🔐 Получение SSL сертификата..."
echo "⚠️  Certbot запустится в интерактивном режиме"
echo "   - Введите email для уведомлений"
echo "   - Выберите опцию 2 (Redirect HTTP to HTTPS)"
echo ""
read -p "Нажмите Enter для продолжения..."

certbot --nginx -d jung-ai.ru -d www.jung-ai.ru

# Проверка сертификата
echo ""
echo "🔍 Проверка полученного сертификата..."
certbot certificates

# Проверка автообновления
echo ""
echo "🔍 Проверка настройки автообновления..."
if systemctl is-enabled --quiet certbot.timer; then
    echo "✅ Автообновление сертификата настроено"
else
    echo "⚠️  Включаю автообновление..."
    systemctl enable certbot.timer
    systemctl start certbot.timer
fi

# Тест продления
echo ""
echo "🧪 Тестирование продления сертификата..."
certbot renew --dry-run

# Перезагрузка Nginx
echo ""
echo "🔄 Перезагрузка Nginx..."
systemctl reload nginx

echo ""
echo "✅ SSL сертификат настроен!"
echo ""
echo "📝 Следующие шаги:"
echo "   1. Обновите .env файл на сервере:"
echo "      cd /var/www/jingai/backend"
echo "      nano .env"
echo ""
echo "   2. Измените переменные:"
echo "      CORS_ORIGIN=\"https://jung-ai.ru,https://www.jung-ai.ru,http://212.193.30.213\""
echo "      FRONTEND_URL=\"https://jung-ai.ru\""
echo ""
echo "   3. Перезапустите backend:"
echo "      pm2 restart all"
echo ""
echo "   4. Проверьте в браузере: https://jung-ai.ru"
echo ""

