#!/bin/bash
# enhanced-debug.sh - Full diagnostic of cookie and auth issues

BASE_URL="http://localhost:8081"
COOKIE_JAR="/tmp/test_cookies.txt"

echo "=== ENHANCED AUTHENTICATION DEBUG ==="
echo ""

# Clean start
rm -f "$COOKIE_JAR" /tmp/headers.txt /tmp/response.json
touch "$COOKIE_JAR"

echo "1. Making login request with FULL output..."
echo "---"

# Show the exact curl command
echo "Command: curl -v -X POST ${BASE_URL}/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"constellar@events.com\",\"password\":\"passWord123\"}' \\"
echo "  -c '$COOKIE_JAR' -D /tmp/headers.txt -o /tmp/response.json"
echo ""

# Run with verbose output to see EVERYTHING
curl -v -X POST \
    "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"constellar@events.com","password":"passWord123"}' \
    -c "$COOKIE_JAR" \
    -D /tmp/headers.txt \
    -o /tmp/response.json 2>&1 | head -50

echo ""
echo "---"
echo ""

echo "2. HTTP Response Status:"
HTTP_STATUS=$(head -1 /tmp/headers.txt 2>/dev/null)
echo "  $HTTP_STATUS"
echo ""

echo "3. ALL Response Headers:"
echo "---"
cat /tmp/headers.txt 2>/dev/null
echo "---"
echo ""

echo "4. Response Body:"
echo "---"
cat /tmp/response.json 2>/dev/null | head -c 500
echo ""
echo "---"
echo ""

echo "5. Cookie Jar Contents:"
echo "---"
cat "$COOKIE_JAR" 2>/dev/null
echo "---"
echo ""

echo "6. Check for Set-Cookie headers:"
if grep -qi "Set-Cookie" /tmp/headers.txt 2>/dev/null; then
    echo "  ✓ Set-Cookie headers found:"
    grep -i "Set-Cookie" /tmp/headers.txt
else
    echo "  ✗ NO Set-Cookie headers in response!"
fi
echo ""

echo "7. Check Response Body for Tokens:"
if grep -q "access_token\|accessToken" /tmp/response.json 2>/dev/null; then
    echo "  ✓ Tokens found in response body!"
    if command -v jq &> /dev/null; then
        echo "  Access Token: $(jq -r '.access_token // .accessToken // "not found"' /tmp/response.json)"
        echo "  Refresh Token: $(jq -r '.refresh_token // .refreshToken // "not found"' /tmp/response.json)"
    else
        grep -o '"access_token":"[^"]*"' /tmp/response.json || echo "  (jq not available for parsing)"
    fi
else
    echo "  ✗ No tokens in response body"
fi
echo ""

echo "8. Testing /auth/me endpoint WITHOUT cookies:"
echo "---"
curl -s -X GET "${BASE_URL}/auth/me" \
    -H "Content-Type: application/json" \
    -D /tmp/headers_me.txt \
    -o /tmp/response_me.json 2>&1

ME_STATUS=$(head -1 /tmp/headers_me.txt 2>/dev/null | grep -o '[0-9]\{3\}')
echo "Status: $ME_STATUS"
cat /tmp/response_me.json 2>/dev/null | head -c 200
echo ""
echo "---"
echo ""

echo "9. Backend Configuration Check:"
echo "---"
echo "Possible Issues:"
echo ""
echo "A. Rate Limiting Active?"
if [ "$HTTP_STATUS" == *"429"* ] || [ "$ME_STATUS" == "429" ]; then
    echo "  ✗ YES - Backend returned 429 (Too Many Requests)"
    echo "    Solution: Disable rate limiting for localhost in your Go backend"
else
    echo "  ✓ No 429 errors detected"
fi
echo ""

echo "B. CORS Configuration?"
echo "  Check if your backend has:"
echo "    - AllowOrigins includes http://localhost:8081"
echo "    - AllowCredentials = true"
echo "    - AllowHeaders includes Cookie"
echo ""

echo "C. Cookie Configuration?"
echo "  Check your Go backend auth handlers for:"
echo "    - c.SetCookie() or c.SetSameSite() calls"
echo "    - HttpOnly, Secure, SameSite settings"
echo "    - Domain and Path settings"
echo ""

echo "=== RECOMMENDATIONS ==="
echo ""

if ! grep -qi "Set-Cookie" /tmp/headers.txt 2>/dev/null; then
    echo "❌ PROBLEM: Backend is NOT setting cookies!"
    echo ""
    echo "Your backend login endpoint is succeeding but NOT setting"
    echo "authentication cookies. This is the root cause."
    echo ""
    echo "Check your Go code in the login handler for:"
    echo "  1. c.SetCookie() calls - are they present?"
    echo "  2. Middleware that might be stripping cookies"
    echo "  3. CORS configuration blocking credentials"
    echo ""
    echo "Example of what SHOULD be in your login handler:"
    echo '  c.SetCookie("access_token", tokenString, 86400, "/", "", false, true)'
    echo ""
else
    echo "✓ Cookies are being set correctly"
fi

if grep -q "access_token\|accessToken" /tmp/response.json 2>/dev/null; then
    echo "✓ Tokens ARE in response body - we can work with this!"
    echo ""
    echo "Your backend returns tokens in JSON instead of cookies."
    echo "The test suite can be modified to use Authorization headers."
fi