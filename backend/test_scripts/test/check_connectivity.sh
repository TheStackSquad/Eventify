#!/bin/bash
# backend/test_scripts/test/check_connectivity.sh

echo "=== CONNECTIVITY CHECK ==="
echo ""

# Load environment variables
ENV_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)/.env"
if [ -f "$ENV_PATH" ]; then
    export $(grep -v '^#' "$ENV_PATH" | sed 's/#.*//g' | grep -v '^\s*$' | xargs)
fi

# Set database variables from env or defaults
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-Eventify}
DB_USER=${DB_USER:-astronautdesh}
DB_PASSWORD=${DB_PASSWORD:-astronautdesh}

# Check API
echo "1. Checking API Server..."
if curl -s -f http://localhost:8081/health > /dev/null; then
    echo "   ✅ API is responding"
else
    echo "   ❌ API is not responding"
    echo "   Try: cd ~/eventify/backend && go run main.go"
fi

echo ""

# Check Database
echo "2. Checking Database..."
if command -v psql > /dev/null; then
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        echo "   ✅ Database is accessible"
    else
        echo "   ❌ Cannot connect to database as $DB_USER"
        echo "   Check if PostgreSQL is running: sudo service postgresql status"
        echo "   Credentials: host=$DB_HOST, port=$DB_PORT, db=$DB_NAME, user=$DB_USER"
    fi
else
    echo "   ⚠️ psql command not found"
fi

echo ""

# Check dependencies
echo "3. Checking Dependencies..."
for cmd in curl jq; do
    if command -v $cmd > /dev/null; then
        echo "   ✅ $cmd installed"
    else
        echo "   ❌ $cmd not installed"
        echo "   Install with: sudo apt install $cmd"
    fi
done

echo ""
echo "=== END CONNECTIVITY CHECK ==="