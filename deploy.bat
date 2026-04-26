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

REM Корень монорепозитория (папка, где лежит deploy.bat)
cd /d "%~dp0"

REM Проверка backend\.env
if not exist backend\.env (
    echo ⚠️  Файл backend\.env не найден. Создайте его перед деплоем.
    echo См. пример в DEPLOYMENT.md
    exit /b 1
)

REM 1. Зависимости всего монорепо (корневой npm ci)
echo.
echo 📦 Установка зависимостей (npm workspaces, корень репозитория)...
if exist package-lock.json (
    call npm ci
) else (
    echo ⚠️  Нет корневого package-lock.json — npm install из корня
    call npm install
)

REM 2. Backend
echo.
echo 📦 Сборка backend...
call npm -w backend run build
echo Применение миграций Prisma...
call npm -w backend run prisma:migrate:deploy

REM 3. Frontend
echo.
echo 📦 Сборка frontend...
call npm -w frontend run build

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

