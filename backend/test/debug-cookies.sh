#!/bin/bash
# debug-cookies.sh - Diagnose cookie extraction issues

COOKIE_JAR="/tmp/test_cookies.txt"
BASE_URL="http://localhost:8081"

echo "=== COOKIE EXTRACTION DEBUG ==="
echo ""

# Clean start
rm -f "$COOKIE_JAR"
touch "$COOKIE_JAR"

# Make a login request
echo "1. Making login request..."
curl -s -X POST \
    "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"constellar@events.com","password":"passWord123"}' \
    -c "$COOKIE_JAR" \
    -D /tmp/headers.txt \
    -o /tmp/response.json

echo ""
echo "2. Raw cookie jar contents:"
echo "---"
cat "$COOKIE_JAR"
echo "---"
echo ""

echo "3. Raw headers:"
echo "---"
cat /tmp/headers.txt | grep -i "set-cookie"
echo "---"
echo ""

echo "4. Testing extraction methods:"
echo ""

# Method 1: Netscape format (column 7)
echo "Method 1 (Netscape format - column 7):"
access_token=$(grep "^[^#]" "$COOKIE_JAR" 2>/dev/null | grep -i "access_token" | awk '{print $7}' | head -1)
echo "  access_token: '${access_token}'"
echo ""

# Method 2: Simple key=value
echo "Method 2 (key=value format):"
access_token=$(grep -o "access_token=[^;[:space:]]*" "$COOKIE_JAR" 2>/dev/null | cut -d'=' -f2 | head -1)
echo "  access_token: '${access_token}'"
echo ""

# Method 3: From headers file
echo "Method 3 (from headers):"
access_token=$(grep -i "Set-Cookie.*access_token" /tmp/headers.txt 2>/dev/null | sed -n 's/.*access_token=\([^;[:space:]]*\).*/\1/p' | head -1)
echo "  access_token: '${access_token}'"
echo ""

# Method 4: Using curl's cookie parsing
echo "Method 4 (direct header parsing):"
access_token=$(grep -i "^Set-Cookie:" /tmp/headers.txt | grep -i "access_token" | sed 's/.*access_token=\([^;]*\).*/\1/' | tr -d '\r')
echo "  access_token: '${access_token}'"
echo ""

echo "5. Response body check:"
cat /tmp/response.json | head -c 200
echo ""
echo ""

echo "=== RECOMMENDATIONS ==="
if [ -z "$access_token" ]; then
    echo "❌ No token found using any method!"
    echo ""
    echo "Possible causes:"
    echo "1. Backend is not setting cookies (check Set-Cookie headers above)"
    echo "2. Cookies are in response body instead of headers"
    echo "3. CORS or cookie domain issues"
    echo ""
    echo "Check if tokens are in response body:"
    jq -r '.access_token // empty' /tmp/response.json 2>/dev/null || echo "  (jq not available or no token in body)"
else
    echo "✅ Found token: ${access_token:0:50}..."
fi