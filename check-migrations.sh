#!/bin/bash

# Скрипт для проверки наличия миграций на сервере

echo "🔍 Проверка миграций на сервере..."
echo ""

# Путь к проекту
PROJECT_PATH="/var/www/jingai"
BACKEND_PATH="$PROJECT_PATH/backend"
MIGRATIONS_PATH="$BACKEND_PATH/prisma/migrations"

echo "Директория проекта: $PROJECT_PATH"
echo "Директория миграций: $MIGRATIONS_PATH"
echo ""

# Проверка существования директории миграций
if [ ! -d "$MIGRATIONS_PATH" ]; then
    echo "❌ Директория миграций не найдена: $MIGRATIONS_PATH"
    exit 1
fi

echo "✅ Директория миграций найдена"
echo ""

# Список всех миграций
echo "📋 Список миграций:"
ls -la "$MIGRATIONS_PATH" | grep "^d" | awk '{print $9}' | grep -v "^\.$" | grep -v "^\.\.$"
echo ""

# Подсчет количества миграций
MIGRATION_COUNT=$(find "$MIGRATIONS_PATH" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "Всего миграций: $MIGRATION_COUNT"
echo ""

# Проверка конкретных важных миграций
echo "🔍 Проверка важных миграций:"

IMPORTANT_MIGRATIONS=(
    "20251005081414_init"
    "20251209000002_add_support_request"
    "20251208000000_add_verification"
    "20251209000000_add_voice_rooms"
)

for migration in "${IMPORTANT_MIGRATIONS[@]}"; do
    if [ -d "$MIGRATIONS_PATH/$migration" ]; then
        echo "✅ $migration - найдена"
        if [ -f "$MIGRATIONS_PATH/$migration/migration.sql" ]; then
            echo "   └─ migration.sql существует ($(wc -l < "$MIGRATIONS_PATH/$migration/migration.sql") строк)"
        else
            echo "   └─ ❌ migration.sql отсутствует!"
        fi
    else
        echo "❌ $migration - НЕ найдена!"
    fi
done

echo ""
echo "📁 Полное дерево миграций:"
tree "$MIGRATIONS_PATH" -L 2 2>/dev/null || find "$MIGRATIONS_PATH" -type f -name "*.sql" | head -20

echo ""
echo "💾 Проверка базы данных:"
DB_PATH="$BACKEND_PATH/prisma/prod.db"
if [ -f "$DB_PATH" ]; then
    echo "✅ База данных найдена: $DB_PATH"
    echo "   Размер: $(du -h "$DB_PATH" | cut -f1)"
    
    # Проверка таблицы _prisma_migrations
    if command -v sqlite3 &> /dev/null; then
        echo ""
        echo "📊 Примененные миграции в БД:"
        sqlite3 "$DB_PATH" "SELECT migration_name, finished_at FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at;" 2>/dev/null || echo "Не удалось проверить таблицу _prisma_migrations"
        
        echo ""
        echo "📊 Существующие таблицы:"
        sqlite3 "$DB_PATH" ".tables" 2>/dev/null | tr ' ' '\n' | grep -v "^$" | sort
    else
        echo "⚠️  sqlite3 не установлен, не могу проверить БД"
    fi
else
    echo "❌ База данных не найдена: $DB_PATH"
fi



