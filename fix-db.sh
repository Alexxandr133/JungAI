#!/bin/bash

# Скрипт для исправления базы данных на продакшн сервере
# Применяет все непримененные миграции Prisma

set -e

echo "🔧 Начало исправления базы данных..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Переход в директорию backend
cd "$(dirname "$0")/backend" || {
    echo -e "${RED}❌ Не могу найти директорию backend${NC}"
    exit 1
}

# Проверка существования .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Файл .env не найден в backend/${NC}"
    echo "Убедитесь, что файл .env существует и содержит DATABASE_URL"
    exit 1
fi

echo -e "${YELLOW}📦 Применение миграций Prisma...${NC}"
npm run prisma:migrate:deploy

echo -e "${YELLOW}🔄 Генерация Prisma клиента...${NC}"
npm run prisma:generate

echo -e "${GREEN}✅ Миграции применены успешно!${NC}"

# Проверка, запущен ли PM2
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}🔄 Перезапуск приложения через PM2...${NC}"
    pm2 restart jingai-backend || echo -e "${YELLOW}⚠️  PM2 процесс не найден, возможно приложение не запущено через PM2${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 не установлен, перезапустите приложение вручную${NC}"
fi

echo ""
echo -e "${GREEN}✅ Готово! База данных исправлена.${NC}"
echo ""
echo "Проверьте логи приложения:"
echo "  pm2 logs jingai-backend --lines 50"
echo ""
echo "Или проверьте API:"
echo "  curl http://localhost:4000/api/health"















