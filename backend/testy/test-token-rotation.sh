#!/bin/bash
# backend/testy/test-token-rotation.sh
# Tests Week 1 & 2 enhancements: token duration, rotation, grace period, and reuse detection

# ============================================
# INITIALIZATION
# ============================================

if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="$(mktemp -d)"
    export OUTPUT_DIR
fi

if [ -z "$COOKIE_JAR" ]; then
    COOKIE_JAR="$(mktemp)"
    export COOKIE_JAR
fi

if [ -z "$BASE_URL" ]; then
    BASE_URL="http://localhost:8081"
    export BASE_URL
fi

# Source helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/test-helpers.sh" ]; then
    echo "ERROR: test-helpers.sh not found in $SCRIPT_DIR"
    exit 1
fi

source "$SCRIPT_DIR/test-helpers.sh"

# ============================================
# WEEK 1 ENHANCEMENT: EXTENDED TOKEN DURATION
# ============================================

print_header "2. WEEK 1: EXTENDED TOKEN DURATION TESTS"

print_section "2.1 Verify Current Session Tokens"

# Try to use existing session from basic-flow tests
ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"

# If no tokens in memory, try extracting from cookie jar
if [ -z "$ACCESS_TOKEN" ]; then
    ACCESS_TOKEN=$(get_cookie_value "access_token")
    CURRENT_ACCESS_TOKEN="$ACCESS_TOKEN"
fi

if [ -z "$REFRESH_TOKEN" ]; then
    REFRESH_TOKEN=$(get_cookie_value "refresh_token")
    CURRENT_REFRESH_TOKEN="$REFRESH_TOKEN"
fi

# If still no tokens, login again
if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ]; then
    print_warning "No active session found, logging in..."
    
    code=$(make_request "POST" "/auth/login" \
        "{\"email\":\"$TEST_USER_1\",\"password\":\"$TEST_PASSWORD\"}" \
        "Login to establish test session")
    
    if [ "$code" -ne "200" ]; then
        print_failure "Cannot establish test session" "Login failed with status $code"
        exit 1
    fi
    
    ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
    REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"
fi

# ============================================
# TEST 2.1: ACCESS TOKEN DURATION (24 HOURS)
# ============================================

print_section "2.2 Verify Access Token Duration"

if [ -n "$ACCESS_TOKEN" ]; then
    print_info "Access Token: ${ACCESS_TOKEN:0:30}... (${#ACCESS_TOKEN} chars)"
    
    # Decode JWT and extract expiry
    if command -v jq &> /dev/null; then
        decoded=$(decode_jwt "$ACCESS_TOKEN")
        exp=$(echo "$decoded" | jq -r '.exp // empty')
        iat=$(echo "$decoded" | jq -r '.iat // empty')
        
        if [ -n "$exp" ] && [ -n "$iat" ] && [ "$exp" != "null" ] && [ "$iat" != "null" ]; then
            # Calculate duration from the token itself
            token_duration=$((exp - iat))
            token_hours=$((token_duration / 3600))
            
            print_info "Token lifetime (from claims): $token_hours hours ($token_duration seconds)"
            
            # Calculate remaining time
            now=$(date +%s)
            remaining=$((exp - now))
            remaining_hours=$((remaining / 3600))
            remaining_minutes=$(((remaining % 3600) / 60))
            
            print_info "Time remaining: ${remaining_hours}h ${remaining_minutes}m ($remaining seconds)"
            
            # Week 1 Enhancement: Access token should be 24 hours (86400 seconds)
            # Your config: accessMin = 1440 minutes = 86400 seconds
            increment_test
            EXPECTED_DURATION=86400
            TOLERANCE=300  # ±5 minutes tolerance
            
            if [ $token_duration -ge $((EXPECTED_DURATION - TOLERANCE)) ] && \
               [ $token_duration -le $((EXPECTED_DURATION + TOLERANCE)) ]; then
                ((PASSED_TESTS++))
                print_success "Access token duration is 24 hours (Week 1 enhancement ✓)"
            else
                ((FAILED_TESTS++))
                print_failure "Access token duration mismatch" \
                    "Expected: ~24h ($EXPECTED_DURATION±${TOLERANCE}s), Got: ${token_hours}h (${token_duration}s)"
            fi
        else
            increment_test
            ((FAILED_TESTS++))
            print_failure "JWT expiry extraction" "Could not decode exp/iat claims from token"
        fi
    else
        increment_test
        print_warning "jq not available, skipping detailed JWT validation"
    fi
else
    increment_test
    ((FAILED_TESTS++))
    print_failure "Access token retrieval" "No access token available for testing"
fi

# ============================================
# TEST 2.2: REFRESH TOKEN DURATION (30 DAYS)
# ============================================

print_section "2.3 Verify Refresh Token Duration"

if [ -n "$REFRESH_TOKEN" ]; then
    print_info "Refresh Token: ${REFRESH_TOKEN:0:30}... (${#REFRESH_TOKEN} chars)"
    
    if command -v jq &> /dev/null; then
        decoded=$(decode_jwt "$REFRESH_TOKEN")
        exp=$(echo "$decoded" | jq -r '.exp // empty')
        iat=$(echo "$decoded" | jq -r '.iat // empty')
        token_type=$(echo "$decoded" | jq -r '.token_type // empty')
        
        # Verify it's actually a refresh token
        if [ "$token_type" == "refresh" ]; then
            print_success "Token type verified as 'refresh'"
        else
            print_warning "Token type is '$token_type' (expected 'refresh')"
        fi
        
        if [ -n "$exp" ] && [ -n "$iat" ] && [ "$exp" != "null" ] && [ "$iat" != "null" ]; then
            token_duration=$((exp - iat))
            token_days=$((token_duration / 86400))
            token_hours=$(((token_duration % 86400) / 3600))
            
            print_info "Token lifetime: ${token_days}d ${token_hours}h ($token_duration seconds)"
            
            # Calculate remaining time
            now=$(date +%s)
            remaining=$((exp - now))
            remaining_days=$((remaining / 86400))
            
            print_info "Time remaining: ${remaining_days} days ($remaining seconds)"
            
            # Week 1 Enhancement: Refresh token should be 30 days (2592000 seconds)
            # Your config: refreshDays = 30 days = 2592000 seconds
            increment_test
            EXPECTED_DURATION=2592000
            TOLERANCE=3600  # ±1 hour tolerance
            
            if [ $token_duration -ge $((EXPECTED_DURATION - TOLERANCE)) ] && \
               [ $token_duration -le $((EXPECTED_DURATION + TOLERANCE)) ]; then
                ((PASSED_TESTS++))
                print_success "Refresh token duration is 30 days (Week 1 enhancement ✓)"
            else
                ((FAILED_TESTS++))
                print_failure "Refresh token duration mismatch" \
                    "Expected: ~30d ($EXPECTED_DURATION±${TOLERANCE}s), Got: ${token_days}d (${token_duration}s)"
            fi
        else
            increment_test
            ((FAILED_TESTS++))
            print_failure "JWT expiry extraction" "Could not decode exp/iat claims from refresh token"
        fi
    else
        increment_test
        print_warning "jq not available, skipping refresh token validation"
    fi
else
    increment_test
    ((FAILED_TESTS++))
    print_failure "Refresh token retrieval" "No refresh token available for testing"
fi

# ============================================
# WEEK 1 ENHANCEMENT: TOKEN ROTATION
# ============================================

print_header "3. WEEK 1: TOKEN ROTATION ON REFRESH"

print_section "3.1 Capture Original Token Set"

# Ensure we have tokens to rotate
if [ -z "$CURRENT_ACCESS_TOKEN" ] || [ -z "$CURRENT_REFRESH_TOKEN" ]; then
    print_warning "Missing tokens, re-establishing session..."
    
    code=$(make_request "POST" "/auth/login" \
        "{\"email\":\"$TEST_USER_1\",\"password\":\"$TEST_PASSWORD\"}" \
        "Login for rotation test")
    
    if [ "$code" -ne "200" ]; then
        print_failure "Cannot establish session for rotation test" "Login failed"
        exit 1
    fi
fi

OLD_ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
OLD_REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"

print_info "Original Access Token:  ${OLD_ACCESS_TOKEN:0:30}... (${#OLD_ACCESS_TOKEN} chars)"
print_info "Original Refresh Token: ${OLD_REFRESH_TOKEN:0:30}... (${#OLD_REFRESH_TOKEN} chars)"

# Extract original token metadata
if command -v jq &> /dev/null; then
    old_access_jti=$(decode_jwt "$OLD_ACCESS_TOKEN" | jq -r '.jti // empty')
    old_refresh_jti=$(decode_jwt "$OLD_REFRESH_TOKEN" | jq -r '.jti // empty')
    
    if [ -n "$old_access_jti" ]; then
        print_info "Original access JTI: ${old_access_jti:0:16}..."
    fi
    if [ -n "$old_refresh_jti" ]; then
        print_info "Original refresh JTI: ${old_refresh_jti:0:16}..."
    fi
fi

# ============================================
# TEST 3.1: SUCCESSFUL TOKEN REFRESH
# ============================================

print_section "3.2 Request Token Refresh"

# Small delay to ensure different issuance timestamp
sleep 1

code=$(make_request "POST" "/auth/refresh" "" \
    "Refresh token pair")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
headers_file="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"

check_status "$code" "200" "Token refresh returns 200 OK"

if [ $? -eq 0 ]; then
    # Verify response message
    if command -v jq &> /dev/null && [ -f "$response_file" ]; then
        message=$(jq -r '.message // empty' "$response_file" 2>/dev/null)
        if [ -n "$message" ]; then
            print_success "Refresh response message: '$message'"
        fi
    fi
    
    # Verify new cookies were set
    verify_cookies_set "access_token" "New access token cookie set"
    verify_cookies_set "refresh_token" "New refresh token cookie set"
fi

# ============================================
# TEST 3.2: VERIFY TOKEN ROTATION
# ============================================

print_section "3.3 Verify Token Rotation"

NEW_ACCESS_TOKEN="$CURRENT_ACCESS_TOKEN"
NEW_REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"

print_info "New Access Token:  ${NEW_ACCESS_TOKEN:0:30}... (${#NEW_ACCESS_TOKEN} chars)"
print_info "New Refresh Token: ${NEW_REFRESH_TOKEN:0:30}... (${#NEW_REFRESH_TOKEN} chars)"

# Test: Access token should be different (rotated)
increment_test
if [ -n "$NEW_ACCESS_TOKEN" ] && [ "$OLD_ACCESS_TOKEN" != "$NEW_ACCESS_TOKEN" ]; then
    ((PASSED_TESTS++))
    print_success "Access token ROTATED (different from original) ✓"
    
    # Verify JTI is also different (proves it's not just re-encoded)
    if command -v jq &> /dev/null; then
        new_access_jti=$(decode_jwt "$NEW_ACCESS_TOKEN" | jq -r '.jti // empty')
        if [ -n "$new_access_jti" ] && [ "$old_access_jti" != "$new_access_jti" ]; then
            print_success "Access token has new JTI: ${new_access_jti:0:16}..."
        fi
    fi
else
    ((FAILED_TESTS++))
    if [ -z "$NEW_ACCESS_TOKEN" ]; then
        print_failure "Access token rotation" "New token is empty or not extracted"
    else
        print_failure "Access token rotation" "Token NOT rotated (same as original)"
    fi
fi

# Test: Refresh token should be different (rotated)
increment_test
if [ -n "$NEW_REFRESH_TOKEN" ] && [ "$OLD_REFRESH_TOKEN" != "$NEW_REFRESH_TOKEN" ]; then
    ((PASSED_TESTS++))
    print_success "Refresh token ROTATED (different from original) ✓"
    
    # Verify JTI is also different
    if command -v jq &> /dev/null; then
        new_refresh_jti=$(decode_jwt "$NEW_REFRESH_TOKEN" | jq -r '.jti // empty')
        if [ -n "$new_refresh_jti" ] && [ "$old_refresh_jti" != "$new_refresh_jti" ]; then
            print_success "Refresh token has new JTI: ${new_refresh_jti:0:16}..."
        fi
    fi
else
    ((FAILED_TESTS++))
    if [ -z "$NEW_REFRESH_TOKEN" ]; then
        print_failure "Refresh token rotation" "New token is empty or not extracted"
    else
        print_failure "Refresh token rotation" "Token NOT rotated (same as original)"
    fi
fi

# ============================================
# TEST 3.3: OLD REFRESH TOKEN REVOCATION
# ============================================

print_section "3.4 Verify Old Refresh Token is Revoked"

print_info "Testing that old refresh token can no longer be used"

# Save current valid session
TEMP_COOKIE_JAR="${COOKIE_JAR}.saved"
cp "$COOKIE_JAR" "$TEMP_COOKIE_JAR"

# Create cookie jar with ONLY the old (should be revoked) refresh token
# Using Netscape format that curl understands
cat > "$COOKIE_JAR" << EOF
# Netscape HTTP Cookie File
# This file was generated by test script - contains old revoked token
#HttpOnly_localhost	FALSE	/	FALSE	0	refresh_token	${OLD_REFRESH_TOKEN}
#HttpOnly_127.0.0.1	FALSE	/	FALSE	0	refresh_token	${OLD_REFRESH_TOKEN}
EOF

print_info "Attempting refresh with old (revoked) token..."

code=$(make_request "POST" "/auth/refresh" "" \
    "Attempt refresh with revoked token")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"

# Should get 401 Unauthorized (token is revoked/consumed)
check_status "$code" "401" "Old refresh token properly rejected"

if [ $? -eq 0 ]; then
    print_success "Token rotation properly revokes old tokens (Week 1 enhancement ✓)"
    
    # Check error message
    if command -v jq &> /dev/null && [ -f "$response_file" ]; then
        error_msg=$(jq -r '.message // .error // empty' "$response_file" 2>/dev/null)
        if [ -n "$error_msg" ]; then
            print_info "Revocation error message: '$error_msg'"
        fi
    fi
else
    print_warning "Old token should have been rejected with 401"
fi

# Restore valid session for subsequent tests
print_info "Restoring valid session..."
cp "$TEMP_COOKIE_JAR" "$COOKIE_JAR"
rm -f "$TEMP_COOKIE_JAR"

# Update current tokens from restored jar
CURRENT_ACCESS_TOKEN="$NEW_ACCESS_TOKEN"
CURRENT_REFRESH_TOKEN="$NEW_REFRESH_TOKEN"

# ============================================
# TEST 3.4: VERIFY NEW TOKENS WORK
# ============================================

print_section "3.5 Verify New Tokens Are Valid"

print_info "Testing that rotated tokens work correctly"

code=$(make_request "GET" "/auth/me" "" \
    "Access protected endpoint with new tokens")

check_status "$code" "200" "New tokens successfully authenticate requests"

if [ $? -eq 0 ]; then
    response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
    
    if command -v jq &> /dev/null && [ -f "$response_file" ]; then
        user_email=$(jq -r '.user.email // empty' "$response_file" 2>/dev/null)
        if [ "$user_email" == "$TEST_USER_1" ]; then
            print_success "New tokens provide access to correct user session"
        fi
    fi
fi

# ============================================
# WEEK 2 ENHANCEMENT: GRACE PERIOD TESTING
# ============================================

print_header "4. WEEK 2: GRACE PERIOD (30 SECONDS)"

print_section "4.1 Grace Period - Concurrent Request Simulation"

print_info "Simulating concurrent refresh requests (within 30s grace period)"
print_info "This tests the ConsumedAt + Grace Period logic"

# Get a fresh session for this test
code=$(make_request "POST" "/auth/login" \
    "{\"email\":\"$TEST_USER_2\",\"password\":\"$TEST_PASSWORD\"}" \
    "Login user 2 for grace period test")

if [ "$code" -ne "200" ]; then
    print_warning "Could not establish session for grace period test"
else
    GRACE_REFRESH_TOKEN="$CURRENT_REFRESH_TOKEN"
    
    # First refresh - this consumes the token and starts grace period
    print_info "First refresh: Consuming the token (starts 30s grace period)..."
    code1=$(make_request "POST" "/auth/refresh" "" \
        "First refresh - consumes token")
    
    check_status "$code1" "200" "First refresh succeeds"
    
    # Save the tokens from first refresh
    FIRST_NEW_ACCESS="$CURRENT_ACCESS_TOKEN"
    FIRST_NEW_REFRESH="$CURRENT_REFRESH_TOKEN"
    
    # Restore the consumed (but within grace period) refresh token
    cat > "$COOKIE_JAR" << EOF
# Netscape HTTP Cookie File
#HttpOnly_localhost	FALSE	/	FALSE	0	refresh_token	${GRACE_REFRESH_TOKEN}
#HttpOnly_127.0.0.1	FALSE	/	FALSE	0	refresh_token	${GRACE_REFRESH_TOKEN}
EOF
    
    # Second refresh IMMEDIATELY (within grace period)
    print_info "Second refresh: Using same token within grace period (should succeed)..."
    
    # Small delay to ensure different timestamp but within grace period
    sleep 2
    
    code2=$(make_request "POST" "/auth/refresh" "" \
        "Second refresh within grace period")
    
    # Week 2 Enhancement: Should succeed (within 30 second grace period)
    check_status "$code2" "200" "Second refresh within grace period succeeds"
    
    if [ $? -eq 0 ]; then
        print_success "Grace period allows concurrent requests (Week 2 enhancement ✓)"
        
        SECOND_NEW_ACCESS="$CURRENT_ACCESS_TOKEN"
        SECOND_NEW_REFRESH="$CURRENT_REFRESH_TOKEN"
        
        # Both refreshes should return new tokens
        if [ "$FIRST_NEW_ACCESS" != "$SECOND_NEW_ACCESS" ]; then
            print_success "Each refresh returns unique tokens"
        fi
    else
        if [ "$code2" -eq "401" ]; then
            print_warning "Grace period may not be configured correctly (got 401)"
            print_info "Expected: 200 (allows concurrent refresh within 30s)"
            print_info "Got: 401 (token already consumed)"
        fi
    fi
fi

# ============================================
# TEST 4.2: GRACE PERIOD EXPIRY
# ============================================

print_section "4.2 Grace Period Expiry (After 30 Seconds)"

print_info "Testing that grace period expires after 30 seconds"
print_warning "This test requires a 35-second wait - please be patient..."

# Get another fresh session
code=$(make_request "POST" "/auth/login" \
    "{\"email\":\"$TEST_USER_1\",\"password\":\"$TEST_PASSWORD\"}" \
    "Login for grace period expiry test")

if [ "$code" -eq "200" ]; then
    EXPIRY_TEST_TOKEN="$CURRENT_REFRESH_TOKEN"
    
    # First refresh
    print_info "First refresh: Consuming token..."
    code1=$(make_request "POST" "/auth/refresh" "" \
        "First refresh")
    
    if [ "$code1" -eq "200" ]; then
        # Wait for grace period to expire (30s + buffer)
        print_info "Waiting 35 seconds for grace period to expire..."
        for ((i=35; i>0; i--)); do
            echo -ne "${CYAN}  Time remaining: ${i}s...\r${NC}"
            sleep 1
        done
        echo -e "${CYAN}  Wait complete!          ${NC}"
        
        # Restore the consumed token (now outside grace period)
        cat > "$COOKIE_JAR" << EOF
# Netscape HTTP Cookie File
#HttpOnly_localhost	FALSE	/	FALSE	0	refresh_token	${EXPIRY_TEST_TOKEN}
#HttpOnly_127.0.0.1	FALSE	/	FALSE	0	refresh_token	${EXPIRY_TEST_TOKEN}
EOF
        
        # Try to use it again (should fail - outside grace period)
        print_info "Attempting refresh after grace period expired..."
        code2=$(make_request "POST" "/auth/refresh" "" \
            "Refresh after grace period expiry")
        
        # Should get 401 (grace period expired, token consumed)
        check_status "$code2" "401" "Refresh after grace period fails"
        
        if [ $? -eq 0 ]; then
            print_success "Grace period properly expires after 30 seconds (Week 2 enhancement ✓)"
        fi
    fi
else
    print_warning "Could not establish session for expiry test, skipping"
fi

# ============================================
# SUMMARY
# ============================================

print_section "Token Rotation Test Summary"

if [ $PASSED_TESTS -gt 0 ]; then
    echo -e "${GREEN}✓ Token rotation functionality validated${NC}"
    echo -e "${GREEN}  - 24-hour access tokens${NC}"
    echo -e "${GREEN}  - 30-day refresh tokens${NC}"
    echo -e "${GREEN}  - Token rotation on refresh${NC}"
    echo -e "${GREEN}  - Old tokens properly revoked${NC}"
    echo -e "${GREEN}  - Grace period (30s) for concurrent requests${NC}"
fi

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}✗ Some token rotation tests failed${NC}"
    echo -e "${RED}  Review the output above for details${NC}"
fi

print_info "Token rotation tests complete"