#!/bin/bash

# Скрипт автоматического деплоя JingAI на продакшен сервер
# Использование: ./deploy.sh

set -e  # Прекратить выполнение при ошибке

echo "🚀 Начало деплоя JingAI..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен. Установите Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Требуется Node.js версии 18 или выше. Текущая версия: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js версия: $(node -v)${NC}"

# Корень монорепозитория (где лежит deploy.sh и корневой package-lock.json)
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

# Проверка существования .env у backend
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}⚠️  Файл backend/.env не найден. Создайте его перед деплоем.${NC}"
    echo "См. пример в DEPLOYMENT.md"
    exit 1
fi

# 1. Зависимости всего монорепо (express и др. оказываются в корневом node_modules)
echo -e "\n${YELLOW}📦 Установка зависимостей (npm workspaces, корень репозитория)...${NC}"
if [ -f package-lock.json ]; then
  npm ci --production=false
else
  echo -e "${YELLOW}⚠️  Нет корневого package-lock.json — npm install из корня${NC}"
  npm install
fi

# 2. Backend сборка
echo -e "\n${YELLOW}📦 Сборка backend...${NC}"
npm -w backend run build

echo "Применение миграций Prisma..."
npm -w backend run prisma:migrate:deploy

# 3. Frontend сборка
echo -e "\n${YELLOW}📦 Сборка frontend...${NC}"
npm -w frontend run build

# 3. Создание директории для логов
echo -e "\n${YELLOW}📁 Создание директорий...${NC}"
mkdir -p logs
mkdir -p backend/prisma/prod

# 4. Проверка PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 не установлен. Устанавливаю PM2...${NC}"
    npm install -g pm2
fi

# 5. Остановка существующего процесса (если запущен)
echo -e "\n${YELLOW}🛑 Остановка существующего процесса...${NC}"
pm2 stop jingai-backend 2>/dev/null || echo "Процесс не был запущен"

# 6. Запуск через PM2
echo -e "\n${GREEN}▶️  Запуск приложения через PM2...${NC}"
pm2 start ecosystem.config.js

# 7. Сохранение конфигурации PM2
echo -e "\n${YELLOW}💾 Сохранение конфигурации PM2...${NC}"
pm2 save

# 8. Настройка автозапуска при перезагрузке (опционально)
echo -e "\n${YELLOW}⚙️  Настройка автозапуска при перезагрузке...${NC}"
read -p "Настроить автозапуск при перезагрузке сервера? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    pm2 startup
    echo -e "${GREEN}✅ Автозапуск настроен${NC}"
fi

# 9. Статус
echo -e "\n${GREEN}✅ Деплой завершен!${NC}"
echo -e "\n${YELLOW}📊 Статус приложения:${NC}"
pm2 status

echo -e "\n${YELLOW}📝 Просмотр логов:${NC}"
echo "  pm2 logs jingai-backend"
echo -e "\n${YELLOW}📊 Мониторинг:${NC}"
echo "  pm2 monit"

