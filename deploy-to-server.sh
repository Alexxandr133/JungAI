#!/bin/bash

# Скрипт для автоматического деплоя JungAI на сервер 212.193.30.213
# Выполняй этот скрипт НА СЕРВЕРЕ после подключения через SSH

set -e  # Прекратить выполнение при ошибке

echo "🚀 Начало деплоя JungAI на сервер..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Установка Node.js 18...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Требуется Node.js версии 18 или выше. Текущая версия: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js версия: $(node -v)${NC}"

# Проверка PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Установка PM2...${NC}"
    npm install -g pm2
fi

# Создание директории проекта
PROJECT_DIR="/var/www/jingai"
echo -e "\n${YELLOW}📁 Создание директории проекта: ${PROJECT_DIR}${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Клонирование или обновление репозитория
if [ -d ".git" ]; then
    echo -e "${YELLOW}🔄 Обновление кода из репозитория...${NC}"
    git pull origin main
else
    echo -e "${YELLOW}📥 Клонирование репозитория...${NC}"
    git clone https://github.com/Alexxandr133/JungAI.git .
fi

# 1. Backend сборка
echo -e "\n${YELLOW}📦 Сборка backend...${NC}"
cd backend

# Проверка существования .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Файл .env не найден. Создаю шаблон...${NC}"
    cat > .env << EOF
DATABASE_URL="file:./prisma/prod.db"
JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
NODE_ENV=production
PORT=4000
CORS_ORIGIN="http://212.193.30.213"
CORS_CREDENTIALS=true
FRONTEND_URL="http://212.193.30.213"
EOF
    echo -e "${GREEN}✅ Файл .env создан. Проверь и отредактируй при необходимости:${NC}"
    echo "   nano $PROJECT_DIR/backend/.env"
fi

echo "Установка зависимостей backend..."
npm ci --production=false

echo "Сборка TypeScript..."
npm run build

echo "Генерация Prisma клиента..."
npm run prisma:generate

echo "Применение миграций..."
npm run prisma:migrate:deploy

cd ..

# 2. Frontend сборка
echo -e "\n${YELLOW}📦 Сборка frontend...${NC}"
cd frontend

echo "Установка зависимостей frontend..."
npm ci

echo "Сборка frontend..."
npm run build

cd ..

# 3. Создание директорий для логов и БД
echo -e "\n${YELLOW}📁 Создание директорий...${NC}"
mkdir -p logs
mkdir -p backend/prisma/prod
mkdir -p backend/uploads/avatars
mkdir -p backend/uploads/verification

# 4. Остановка существующего процесса (если запущен)
echo -e "\n${YELLOW}🛑 Остановка существующего процесса...${NC}"
pm2 stop jingai-backend 2>/dev/null || echo "Процесс не был запущен"

# 5. Запуск через PM2
echo -e "\n${GREEN}▶️  Запуск приложения через PM2...${NC}"
pm2 start ecosystem.config.js || pm2 restart jingai-backend

# 6. Сохранение конфигурации PM2
echo -e "\n${YELLOW}💾 Сохранение конфигурации PM2...${NC}"
pm2 save

# 7. Настройка автозапуска при перезагрузке
echo -e "\n${YELLOW}⚙️  Настройка автозапуска при перезагрузке...${NC}"
pm2 startup systemd -u root --hp /root || echo "Автозапуск уже настроен"

# 8. Статус
echo -e "\n${GREEN}✅ Деплой завершен!${NC}"
echo -e "\n${YELLOW}📊 Статус приложения:${NC}"
pm2 status

echo -e "\n${YELLOW}📝 Просмотр логов:${NC}"
echo "  pm2 logs jingai-backend"
echo -e "\n${YELLOW}📊 Мониторинг:${NC}"
echo "  pm2 monit"
echo -e "\n${GREEN}🌐 Приложение доступно по адресу: http://212.193.30.213:4000${NC}"

