#!/bin/bash
# backend/test_scripts/test/check_connectivity.sh

echo "=== CONNECTIVITY CHECK ==="
echo ""

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
    if PGPASSWORD=postgres psql -h localhost -U postgres -d eventify_db -c "SELECT 1" > /dev/null 2>&1; then
        echo "   ✅ Database is accessible"
    else
        echo "   ❌ Cannot connect to database"
        echo "   Check if PostgreSQL is running: sudo service postgresql status"
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