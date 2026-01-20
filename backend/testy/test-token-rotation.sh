#!/bin/bash
# backend/test/test-token-rotation.sh
# Tests token duration, rotation on refresh, and revocation.

# Requires global variables: TEST_USER_1, TEST_PASSWORD, OUTPUT_DIR, COOKIE_JAR

# ============================================
# 2. WEEK 1 ENHANCEMENT: EXTENDED TOKEN DURATION
# ============================================
print_header "2. WEEK 1: EXTENDED TOKEN DURATION TESTS"

# DON'T clear cookie jar here - use existing session from basic-flow
# The previous test should have left us logged in

print_section "2.1: Check Current Session Tokens"

# Extract access token from stored tokens
ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"

if [ -z "$ACCESS_TOKEN" ]; then
    print_warning "No access token found, logging in again..."
    code=$(make_request "POST" "/auth/login" \
        "{\"email\":\"$TEST_USER_1\",\"password\":\"$TEST_PASSWORD\"}" \
        "Re-login to test token duration")
    
    ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
    REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"
fi

if [ -n "$ACCESS_TOKEN" ]; then
    print_info "Access Token found: ${ACCESS_TOKEN:0:20}... (${#ACCESS_TOKEN} chars)"
    
    # Decode and check expiry
    EXPIRY=$(get_jwt_expiry "$ACCESS_TOKEN")
    if [ -n "$EXPIRY" ] && [ "$EXPIRY" != "null" ]; then
        NOW=$(date +%s)
        DURATION=$((EXPIRY - NOW))
        HOURS=$((DURATION / 3600))
        
        print_info "Access token expires in: $HOURS hours ($DURATION seconds)"
        
        # ✅ WEEK 1: Should be 24 hours (86400 seconds) ±5 minutes tolerance
        increment_test
        if [ $DURATION -ge 86100 ] && [ $DURATION -le 86700 ]; then
            print_success "Access token duration is ~24 hours (Week 1 enhancement verified)"
        else
            print_failure "Access token duration check" "Duration is $HOURS hours (expected ~24 hours)"
        fi
    else
        increment_test
        print_failure "Access token expiry decode" "Could not decode access token expiry"
    fi
else
    increment_test
    print_failure "Access token retrieval" "Access token not found in cookies after login"
fi

if [ -n "$REFRESH_TOKEN" ]; then
    print_info "Refresh Token found: ${REFRESH_TOKEN:0:20}..."
    
    REFRESH_EXPIRY=$(get_jwt_expiry "$REFRESH_TOKEN")
    if [ -n "$REFRESH_EXPIRY" ]; then
        NOW=$(date +%s)
        REFRESH_DURATION=$((REFRESH_EXPIRY - NOW))
        DAYS=$((REFRESH_DURATION / 86400))
        
        print_info "Refresh token expires in: $DAYS days ($REFRESH_DURATION seconds)"
        
        # ✅ WEEK 1: Should be 30 days (2592000 seconds) ±1 hour tolerance
        increment_test
        if [ $REFRESH_DURATION -ge 2588400 ] && [ $REFRESH_DURATION -le 2595600 ]; then
            print_success "Refresh token duration is ~30 days (Week 1 enhancement verified)"
        else
            print_failure "Refresh token duration check" "Duration is $DAYS days (expected ~30 days)"
        fi
    fi
fi

# ============================================
# 3. WEEK 1 ENHANCEMENT: TOKEN ROTATION ON REFRESH
# ============================================
print_header "3. WEEK 1: TOKEN ROTATION ON REFRESH"

print_section "3.1: Capture Original Tokens"

OLD_ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
OLD_REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"

if [ -z "$OLD_ACCESS_TOKEN" ] || [ -z "$OLD_REFRESH_TOKEN" ]; then
    print_warning "Missing tokens, cannot test rotation. Logging in..."
    make_request "POST" "/auth/login" \
        "{\"email\":\"$TEST_USER_1\",\"password\":\"$TEST_PASSWORD\"}" \
        "Login for token rotation test" > /dev/null
    
    OLD_ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
    OLD_REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"
fi

print_info "Original Access Token: ${OLD_ACCESS_TOKEN:0:30}... (${#OLD_ACCESS_TOKEN} chars)"
print_info "Original Refresh Token: ${OLD_REFRESH_TOKEN:0:30}... (${#OLD_REFRESH_TOKEN} chars)"

print_section "3.2: Call Refresh Endpoint"

code=$(make_request "POST" "/auth/refresh" "" \
    "Refresh tokens")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
headers_file="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"

check_status "$code" "200" "Token refresh successful"

print_section "3.3: Verify New Tokens Issued"

NEW_ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
NEW_REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"

print_info "New Access Token: ${NEW_ACCESS_TOKEN:0:30}... (${#NEW_ACCESS_TOKEN} chars)"
print_info "New Refresh Token: ${NEW_REFRESH_TOKEN:0:30}... (${#NEW_REFRESH_TOKEN} chars)"

# ✅ WEEK 1: Both tokens should be rotated
increment_test
if [ -n "$NEW_ACCESS_TOKEN" ] && [ "$OLD_ACCESS_TOKEN" != "$NEW_ACCESS_TOKEN" ]; then
    print_success "Access token rotated (Week 1 enhancement verified)"
else
    if [ -z "$NEW_ACCESS_TOKEN" ]; then
        print_failure "Access token rotation" "New token is empty"
    else
        print_failure "Access token rotation" "Same token returned"
    fi
fi

increment_test
if [ -n "$NEW_REFRESH_TOKEN" ] && [ "$OLD_REFRESH_TOKEN" != "$NEW_REFRESH_TOKEN" ]; then
    print_success "Refresh token rotated (Week 1 enhancement verified)"
else
    if [ -z "$NEW_REFRESH_TOKEN" ]; then
        print_failure "Refresh token rotation" "New token is empty"
    else
        print_failure "Refresh token rotation" "Same token returned"
    fi
fi

print_section "3.4: Verify Old Refresh Token is Revoked"

# Save new tokens temporarily
TEMP_COOKIE_JAR="${COOKIE_JAR}.temp"
cp "$COOKIE_JAR" "$TEMP_COOKIE_JAR"

# Try using old refresh token by manually setting it
echo "# Netscape HTTP Cookie File" > "$COOKIE_JAR"
echo "localhost	FALSE	/	FALSE	0	refresh_token	${OLD_REFRESH_TOKEN}" >> "$COOKIE_JAR"

code=$(make_request "POST" "/auth/refresh" "" \
    "Attempt refresh with old (revoked) token")

check_status "$code" "401" "Old refresh token rejected (properly revoked)"

# Restore new tokens for subsequent tests
cp "$TEMP_COOKIE_JAR" "$COOKIE_JAR"
rm -f "$TEMP_COOKIE_JAR"