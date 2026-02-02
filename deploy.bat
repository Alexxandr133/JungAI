@echo off
REM Скрипт автоматического деплоя JingAI на продакшен сервер (Windows)
REM Использование: deploy.bat

echo 🚀 Начало деплоя JingAI...

REM Проверка Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js не установлен. Установите Node.js 18+
    exit /b 1
)

echo ✅ Node.js установлен

REM 1. Backend сборка
echo.
echo 📦 Сборка backend...
cd backend

REM Проверка существования .env
if not exist .env (
    echo ⚠️  Файл .env не найден. Создайте его перед деплоем.
    echo См. пример в DEPLOYMENT.md
    exit /b 1
)

echo Установка зависимостей backend...
call npm ci

echo Сборка TypeScript...
call npm run build

echo Генерация Prisma клиента...
call npm run prisma:generate

echo Применение миграций...
call npm run prisma:migrate:deploy

cd ..

REM 2. Frontend сборка
echo.
echo 📦 Сборка frontend...
cd frontend

echo Установка зависимостей frontend...
call npm ci

echo Сборка frontend...
call npm run build

cd ..

REM 3. Создание директории для логов
echo.
echo 📁 Создание директорий...
if not exist logs mkdir logs
if not exist backend\prisma\prod mkdir backend\prisma\prod

REM 4. Проверка PM2
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  PM2 не установлен. Устанавливаю PM2...
    call npm install -g pm2
)

REM 5. Остановка существующего процесса (если запущен)
echo.
echo 🛑 Остановка существующего процесса...
pm2 stop jingai-backend 2>nul

REM 6. Запуск через PM2
echo.
echo ▶️  Запуск приложения через PM2...
pm2 start ecosystem.config.js

REM 7. Сохранение конфигурации PM2
echo.
echo 💾 Сохранение конфигурации PM2...
pm2 save

echo.
echo ✅ Деплой завершен!
echo.
echo 📊 Статус приложения:
pm2 status

echo.
echo 📝 Просмотр логов: pm2 logs jingai-backend
echo 📊 Мониторинг: pm2 monit

