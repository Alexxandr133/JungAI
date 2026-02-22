#!/bin/bash

echo "=== Диагностика домена jung-ai.ru ==="
echo ""

# 1. Проверка DNS
echo "1. Проверка DNS записей:"
echo "----------------------------"
dig +short jung-ai.ru A
dig +short www.jung-ai.ru A
echo ""

# 2. Проверка доступности по IP
echo "2. Проверка доступности по IP (212.193.30.213):"
echo "------------------------------------------------"
curl -I http://212.193.30.213 2>&1 | head -5
echo ""

# 3. Проверка доступности по домену
echo "3. Проверка доступности по домену:"
echo "-----------------------------------"
curl -I http://jung-ai.ru 2>&1 | head -10
echo ""

# 4. Проверка статуса Nginx
echo "4. Статус Nginx:"
echo "----------------"
systemctl status nginx --no-pager | head -10
echo ""

# 5. Проверка конфигурации Nginx
echo "5. Проверка конфигурации Nginx:"
echo "-------------------------------"
nginx -t 2>&1
echo ""

# 6. Проверка активных конфигураций
echo "6. Активные конфигурации Nginx:"
echo "-------------------------------"
ls -la /etc/nginx/sites-enabled/
echo ""

# 7. Проверка логов Nginx (последние 20 строк)
echo "7. Последние ошибки Nginx:"
echo "--------------------------"
tail -20 /var/log/nginx/jung-ai-error.log 2>/dev/null || echo "Лог файл не найден"
echo ""

# 8. Проверка, слушает ли Nginx на порту 80
echo "8. Проверка портов:"
echo "-------------------"
ss -tlnp | grep :80
echo ""

# 9. Проверка backend
echo "9. Проверка backend:"
echo "--------------------"
curl -s http://localhost:4000/api/health || echo "Backend не отвечает"
echo ""

# 10. Проверка frontend
echo "10. Проверка frontend:"
echo "---------------------"
ls -la /var/www/jingai/frontend/dist/ | head -5
echo ""

echo "=== Конец диагностики ==="

