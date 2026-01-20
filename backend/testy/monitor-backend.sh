#!/bin/bash
# monitor-backend.sh - Continuously check if backend is alive during tests

BASE_URL="http://localhost:8081"
CHECK_INTERVAL=2

echo "=== BACKEND MONITOR ==="
echo "Checking $BASE_URL every ${CHECK_INTERVAL}s"
echo "Press Ctrl+C to stop"
echo ""

consecutive_failures=0

while true; do
    # Try to connect
    response=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout 2 "${BASE_URL}/auth/me" 2>&1)
    timestamp=$(date +"%H:%M:%S")
    
    if [ "$response" == "401" ] || [ "$response" == "200" ]; then
        echo "[$timestamp] ✅ Backend ALIVE (Status: $response)"
        consecutive_failures=0
    elif [ "$response" == "429" ]; then
        echo "[$timestamp] ⚠️  Backend RATE LIMITED (Status: 429)"
        consecutive_failures=0
    elif [ "$response" == "000" ] || [ -z "$response" ]; then
        ((consecutive_failures++))
        echo "[$timestamp] ❌ Backend DOWN - Connection failed ($consecutive_failures times)"
        
        if [ $consecutive_failures -ge 3 ]; then
            echo ""
            echo "⚠️  WARNING: Backend has been down for $((consecutive_failures * CHECK_INTERVAL)) seconds!"
            echo "   Check your backend logs for crashes or errors."
            echo ""
        fi
    else
        echo "[$timestamp] ⚠️  Backend responding (Status: $response)"
        consecutive_failures=0
    fi
    
    sleep $CHECK_INTERVAL
done