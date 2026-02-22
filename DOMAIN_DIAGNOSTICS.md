# 🔍 Диагностика домена jung-ai.ru

## Команды для проверки на сервере:

```bash
# 1. Подключиться к серверу
ssh root@212.193.30.213

# 2. Скачать скрипт диагностики (если его нет на сервере)
cd /var/www/jingai
# Или создать вручную:
cat > check-domain.sh << 'EOF'
#!/bin/bash
echo "=== Диагностика домена jung-ai.ru ==="
echo ""
echo "1. Проверка DNS записей:"
dig +short jung-ai.ru A
echo ""
echo "2. Проверка доступности по IP:"
curl -I http://212.193.30.213 2>&1 | head -5
echo ""
echo "3. Проверка доступности по домену:"
curl -I http://jung-ai.ru 2>&1 | head -10
echo ""
echo "4. Статус Nginx:"
systemctl status nginx --no-pager | head -5
echo ""
echo "5. Проверка конфигурации Nginx:"
nginx -t
echo ""
echo "6. Активные конфигурации:"
ls -la /etc/nginx/sites-enabled/
echo ""
echo "7. Последние ошибки Nginx:"
tail -20 /var/log/nginx/jung-ai-error.log 2>/dev/null || echo "Лог не найден"
echo ""
echo "8. Проверка портов:"
ss -tlnp | grep :80
echo ""
echo "9. Проверка backend:"
curl -s http://localhost:4000/api/health || echo "Backend не отвечает"
echo ""
EOF
chmod +x check-domain.sh
./check-domain.sh
```

## Пошаговая проверка:

### Шаг 1: Проверка DNS

```bash
# Проверка с сервера
dig +short jung-ai.ru A

# Должно вернуть: 212.193.30.213
# Если возвращает пусто или другой IP - проблема в DNS
```

### Шаг 2: Проверка Nginx конфигурации

```bash
# Проверьте, что конфигурация существует
ls -la /etc/nginx/sites-available/jung-ai
ls -la /etc/nginx/sites-enabled/jung-ai

# Проверьте содержимое конфигурации
cat /etc/nginx/sites-available/jung-ai | grep server_name

# Должно быть: server_name jung-ai.ru www.jung-ai.ru 212.193.30.213;
```

### Шаг 3: Проверка и перезагрузка Nginx

```bash
# Проверка синтаксиса
sudo nginx -t

# Если есть ошибки - исправьте их
# Если все ОК - перезагрузите
sudo systemctl reload nginx

# Проверьте статус
sudo systemctl status nginx
```

### Шаг 4: Проверка логов

```bash
# Логи ошибок
sudo tail -50 /var/log/nginx/jung-ai-error.log

# Логи доступа
sudo tail -50 /var/log/nginx/jung-ai-access.log
```

### Шаг 5: Проверка доступности

```bash
# С сервера
curl -I http://localhost
curl -I http://212.193.30.213
curl -I http://jung-ai.ru

# Проверка API
curl http://localhost:4000/api/health
curl http://212.193.30.213/api/health
```

## Возможные проблемы:

1. **DNS не распространился** - проверьте с разных DNS серверов:
   ```bash
   dig @8.8.8.8 jung-ai.ru A
   dig @1.1.1.1 jung-ai.ru A
   ```

2. **Nginx не слушает на порту 80** - проверьте:
   ```bash
   sudo ss -tlnp | grep :80
   sudo netstat -tlnp | grep :80
   ```

3. **Конфигурация не применена** - убедитесь, что:
   - Файл существует в `/etc/nginx/sites-available/jung-ai`
   - Симлинк создан в `/etc/nginx/sites-enabled/jung-ai`
   - Nginx перезагружен после изменений

4. **Firewall блокирует порт 80** - проверьте:
   ```bash
   sudo ufw status
   sudo iptables -L -n | grep 80
   ```

5. **Frontend не собран** - проверьте:
   ```bash
   ls -la /var/www/jingai/frontend/dist/
   # Должен быть index.html
   ```

## Быстрое исправление:

Если DNS еще не распространился, можно временно добавить в `/etc/hosts` на вашем компьютере:

```
212.193.30.213 jung-ai.ru www.jung-ai.ru
```

Но это только для локального тестирования.

