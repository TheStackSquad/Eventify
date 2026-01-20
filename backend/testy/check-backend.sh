#!/bin/bash
# check-backend.sh - Verify backend server is running and ready

BASE_URL="http://localhost:8081"

echo "=== BACKEND HEALTH CHECK ==="
echo ""
echo "Checking if backend is running on $BASE_URL..."
echo ""

# Try to connect
if curl -s --connect-timeout 3 "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "✅ Backend is RUNNING"
    echo ""
    
    # Try to get health endpoint details
    echo "Health check response:"
    curl -s "${BASE_URL}/health" | head -c 500
    echo ""
    
elif curl -s --connect-timeout 3 "${BASE_URL}/" > /dev/null 2>&1; then
    echo "✅ Backend is RUNNING (no /health endpoint, but server responding)"
    echo ""
    
else
    echo "❌ Backend is NOT RUNNING"
    echo ""
    echo "The server is not responding on port 8081."
    echo ""
    echo "To start your backend:"
    echo "  1. Open a new terminal"
    echo "  2. cd ~/eventify/backend"
    echo "  3. Run: go run main.go"
    echo "     OR: go run cmd/main.go"
    echo "     OR: air (if using hot reload)"
    echo ""
    echo "Common issues:"
    echo "  - Wrong port (check your .env or config file)"
    echo "  - Server crashed (check logs)"
    echo "  - Database not connected"
    echo "  - Port 8081 in use by another process"
    echo ""
    
    # Check if port is in use
    if netstat -an 2>/dev/null | grep -q ":8081.*LISTEN"; then
        echo "⚠️  Port 8081 IS in use by another process"
        echo "    Use: netstat -ano | findstr :8081"
        echo "    Or: lsof -i :8081 (on Unix)"
    else
        echo "ℹ️  Port 8081 is available"
    fi
    
    exit 1
fi

echo ""
echo "=== TESTING AUTH ENDPOINTS ==="
echo ""

# Test login endpoint exists
echo "Checking /auth/login endpoint..."
response=$(curl -s -w "%{http_code}" -o /tmp/login_check.json -X POST \
    "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}' 2>&1)

http_code="${response: -3}"

if [ "$http_code" == "400" ] || [ "$http_code" == "401" ] || [ "$http_code" == "200" ]; then
    echo "  ✅ Login endpoint responding (Status: $http_code)"
    echo "     This is good - endpoint exists even if credentials are wrong"
elif [ "$http_code" == "404" ]; then
    echo "  ❌ Login endpoint NOT FOUND (404)"
    echo "     Check your routes - /auth/login may not be configured"
elif [ "$http_code" == "429" ]; then
    echo "  ⚠️  Rate limited (429)"
    echo "     Backend is responding but blocking requests"
else
    echo "  Status: $http_code"
fi

echo ""
echo "=== BACKEND STATUS: READY ✅ ==="
echo ""
echo "You can now run the test suite:"
echo "  ./auth-test-suite.sh"
echo ""