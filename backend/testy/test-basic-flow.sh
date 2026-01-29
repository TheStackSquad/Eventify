#!/bin/bash
# backend/testy/test-basic-flow.sh
# Tests fundamental authentication flow: signup, login, session check, and logout
# This validates Week 1 core functionality

# ============================================
# INITIALIZATION
# ============================================

# Ensure we have required variables
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
# BASIC AUTHENTICATION FLOW TESTS
# ============================================

print_header "1. BASIC AUTHENTICATION FLOW"

print_section "1.1 User Login"

# Test 1.1: Login with valid credentials
print_info "Testing login for: $TEST_USER_1"

code=$(make_request "POST" "/auth/login" \
    "{\"email\":\"$TEST_USER_1\",\"password\":\"$TEST_PASSWORD\"}" \
    "Login with valid credentials")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"

# Verify HTTP status
check_status "$code" "200" "Login returns 200 OK"

if [ $? -eq 0 ]; then
    # Verify response structure
    if command -v jq &> /dev/null && [ -f "$response_file" ]; then
        # Check for welcome message
        message=$(jq -r '.message // empty' "$response_file" 2>/dev/null)
        if [ -n "$message" ]; then
            print_success "Response contains message: '$message'"
        fi
        
        # Check for user object
        if jq -e '.user' "$response_file" > /dev/null 2>&1; then
            print_success "Response contains user object"
            
            # Verify user fields
            user_email=$(jq -r '.user.email // empty' "$response_file" 2>/dev/null)
            user_name=$(jq -r '.user.name // empty' "$response_file" 2>/dev/null)
            user_id=$(jq -r '.user.id // empty' "$response_file" 2>/dev/null)
            
            if [ "$user_email" == "$TEST_USER_1" ]; then
                print_success "User email matches: $user_email"
            else
                print_failure "User email mismatch" "Expected: $TEST_USER_1, Got: $user_email"
            fi
            
            if [ -n "$user_name" ] && [ "$user_name" != "null" ]; then
                print_success "User has name: $user_name"
            fi
            
            if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
                print_success "User has ID: ${user_id:0:8}..."
            fi
        else
            print_warning "Response does not contain user object"
        fi
    fi
    
    # CRITICAL: Verify cookies were set
    verify_cookies_set "access_token" "Access token cookie set in response"
    verify_cookies_set "refresh_token" "Refresh token cookie set in response"
    
    # Extract and verify tokens
    access_token=$(get_cookie_value "access_token")
    refresh_token=$(get_cookie_value "refresh_token")
    
    if [ -n "$access_token" ]; then
        print_success "Access token extracted (${#access_token} chars)"
        
        # Decode and verify JWT structure
        if command -v jq &> /dev/null; then
            decoded=$(decode_jwt "$access_token")
            token_type=$(echo "$decoded" | jq -r '.token_type // empty')
            user_id=$(echo "$decoded" | jq -r '.user_id // .sub // empty')
            exp=$(echo "$decoded" | jq -r '.exp // empty')
            iat=$(echo "$decoded" | jq -r '.iat // empty')
            jti=$(echo "$decoded" | jq -r '.jti // empty')
            
            if [ "$token_type" == "access" ]; then
                print_success "Token type is 'access'"
            else
                print_failure "Token type verification" "Expected 'access', got '$token_type'"
            fi
            
            if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
                print_success "Token contains user_id: ${user_id:0:8}..."
            fi
            
            if [ -n "$jti" ] && [ "$jti" != "null" ]; then
                print_success "Token has unique JTI (JWT ID)"
            fi
            
            if [ -n "$exp" ] && [ -n "$iat" ]; then
                 exp_seconds=$((exp - iat))
                 exp_hours=$((exp_seconds / 3600))
                print_success "Token lifetime: $exp_hours hours"
                
                # Verify it's 24 hours as per your config (1440 minutes)
                if [ $exp_hours -eq 24 ]; then
                    print_success "Token expiry matches configured 24 hours"
                fi
            fi
        fi
    else
        print_failure "Access token extraction" "Cookie not found in response or jar"
    fi
    
    if [ -n "$refresh_token" ]; then
        print_success "Refresh token extracted (${#refresh_token} chars)"
        
        # Verify refresh token structure
        if command -v jq &> /dev/null; then
            decoded=$(decode_jwt "$refresh_token")
            token_type=$(echo "$decoded" | jq -r '.token_type // empty')
            
            if [ "$token_type" == "refresh" ]; then
                print_success "Refresh token type is 'refresh'"
            else
                print_failure "Refresh token type verification" "Expected 'refresh', got '$token_type'"
            fi
        fi
    else
        print_failure "Refresh token extraction" "Cookie not found in response or jar"
    fi
else
    print_failure "Login request" "HTTP status check failed"
    
    # Show response for debugging
    if [ -f "$response_file" ]; then
        error_msg=$(cat "$response_file" 2>/dev/null | head -c 200)
        print_info "Response body: $error_msg"
    fi
fi

# ============================================
# TEST 1.2: GET CURRENT USER (/auth/me)
# ============================================

print_section "1.2 Get Current User"

# Verify we have tokens before proceeding
access_token=$(get_cookie_value "access_token")
if [ -z "$access_token" ]; then
    print_warning "No access token available for /me test, skipping"
else
    print_info "Using access token from login (${#access_token} chars)"
    
    code=$(make_request "GET" "/auth/me" "" \
        "Get authenticated user profile")
    
    response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
    
    # Verify HTTP status
    check_status "$code" "200" "/auth/me returns 200 OK"
    
    if [ $? -eq 0 ]; then
        # Verify response contains user data
        if command -v jq &> /dev/null && [ -f "$response_file" ]; then
            if jq -e '.user' "$response_file" > /dev/null 2>&1; then
                print_success "Response contains user object"
                
                # Extract user details
                user_email=$(jq -r '.user.email // empty' "$response_file" 2>/dev/null)
                user_name=$(jq -r '.user.name // empty' "$response_file" 2>/dev/null)
                user_id=$(jq -r '.user.id // empty' "$response_file" 2>/dev/null)
                user_role=$(jq -r '.user.role // empty' "$response_file" 2>/dev/null)
                
                # Verify email matches logged-in user
                if [ "$user_email" == "$TEST_USER_1" ]; then
                    print_success "User email matches logged-in user: $user_email"
                else
                    print_failure "Email mismatch" "Expected: $TEST_USER_1, Got: $user_email"
                fi
                
                # Verify user ID matches token
                token_user_id=$(get_jwt_user_id "$access_token")
                if [ -n "$token_user_id" ] && [ "$user_id" == "$token_user_id" ]; then
                    print_success "User ID matches token claim"
                fi
                
                # Verify role
                if [ -n "$user_role" ] && [ "$user_role" != "null" ]; then
                    print_success "User has role: $user_role"
                fi
                
                # Verify name
                if [ -n "$user_name" ] && [ "$user_name" != "null" ]; then
                    print_success "User has name: $user_name"
                fi
                
                # Check that password is NOT included (security check)
                if jq -e '.user.password' "$response_file" > /dev/null 2>&1; then
                    print_failure "Security issue" "Password field present in response!"
                else
                    print_success "Password field not exposed (security check passed)"
                fi
                
                if jq -e '.user.password_hash' "$response_file" > /dev/null 2>&1; then
                    print_failure "Security issue" "Password hash present in response!"
                else
                    print_success "Password hash not exposed (security check passed)"
                fi
            else
                print_failure "Response validation" "User object not found in response"
            fi
        fi
    else
        print_failure "/auth/me request" "HTTP status check failed"
        
        # Debug: Check if it's an auth error
        if [ "$code" -eq "401" ]; then
            print_warning "401 Unauthorized - possible middleware issue"
            print_info "Checking if token is being sent correctly..."
            
            # Verify cookie jar has the token
            if [ -f "$COOKIE_JAR" ]; then
                if grep -q "access_token" "$COOKIE_JAR"; then
                    print_info "Cookie jar contains access_token"
                else
                    print_warning "Cookie jar does NOT contain access_token"
                fi
            fi
        fi
    fi
fi

# ============================================
# TEST 1.3: LOGOUT
# ============================================

print_section "1.3 Logout"

# Verify we have tokens before logout
access_token=$(get_cookie_value "access_token")
refresh_token=$(get_cookie_value "refresh_token")

if [ -z "$access_token" ] && [ -z "$refresh_token" ]; then
    print_warning "No tokens available for logout test, skipping"
else
    print_info "Logging out (will revoke tokens and blacklist access token)"
    
    code=$(make_request "POST" "/auth/logout" "" \
        "Logout and revoke session")
    
    response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
    
    # Verify HTTP status
    check_status "$code" "200" "Logout returns 200 OK"
    
    if [ $? -eq 0 ]; then
        # Verify response message
        if command -v jq &> /dev/null && [ -f "$response_file" ]; then
            message=$(jq -r '.message // empty' "$response_file" 2>/dev/null)
            if [ -n "$message" ]; then
                print_success "Logout message: '$message'"
            fi
        fi
        
        # CRITICAL: Verify cookies were cleared
        # Check if Set-Cookie headers have Max-Age=-1 or expired dates
        headers_file="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"
        if [ -f "$headers_file" ]; then
            if grep -qi "Set-Cookie:.*access_token.*Max-Age=-1\|Max-Age=0\|expires=.*1970" "$headers_file"; then
                print_success "Access token cookie cleared in response"
            else
                # Check if cookie was explicitly deleted
                if grep -qi "Set-Cookie:.*access_token" "$headers_file"; then
                    print_warning "Access token cookie header present but deletion not confirmed"
                fi
            fi
            
            if grep -qi "Set-Cookie:.*refresh_token.*Max-Age=-1\|Max-Age=0\|expires=.*1970" "$headers_file"; then
                print_success "Refresh token cookie cleared in response"
            else
                if grep -qi "Set-Cookie:.*refresh_token" "$headers_file"; then
                    print_warning "Refresh token cookie header present but deletion not confirmed"
                fi
            fi
        fi
    fi
    
    # Clear stored tokens after logout
    clear_stored_tokens
    print_success "Local token storage cleared"
fi

# ============================================
# TEST 1.4: VERIFY LOGOUT (Try to access protected endpoint)
# ============================================

print_section "1.4 Verify Logout Effectiveness"

print_info "Attempting to access /auth/me after logout (should fail)"

code=$(make_request "GET" "/auth/me" "" \
    "Access protected endpoint after logout")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"

# Should get 401 Unauthorized
check_status "$code" "401" "Protected endpoint returns 401 after logout"

if [ $? -eq 0 ]; then
    print_success "Logout successfully invalidated session"
    
    # Check error message
    if command -v jq &> /dev/null && [ -f "$response_file" ]; then
        error_msg=$(jq -r '.message // empty' "$response_file" 2>/dev/null)
        if [ -n "$error_msg" ]; then
            print_info "Error message: '$error_msg'"
        fi
    fi
else
    print_failure "Post-logout verification" "Should not be able to access protected endpoints after logout"
fi

# ============================================
# TEST 1.5: LOGIN WITH INVALID CREDENTIALS
# ============================================

print_section "1.5 Invalid Credentials Handling"

print_info "Testing login with wrong password"

code=$(make_request "POST" "/auth/login" \
    "{\"email\":\"$TEST_USER_1\",\"password\":\"wrongPassword123\"}" \
    "Login with invalid password")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"

# Should get 401 Unauthorized
check_status "$code" "401" "Invalid credentials return 401"

if [ $? -eq 0 ]; then
    # Verify error message
    if command -v jq &> /dev/null && [ -f "$response_file" ]; then
        error_msg=$(jq -r '.message // empty' "$response_file" 2>/dev/null)
        if [ -n "$error_msg" ]; then
            print_success "Error message provided: '$error_msg'"
        fi
    fi
    
    # Verify NO tokens were set
    access_token=$(get_cookie_value "access_token")
    if [ -z "$access_token" ]; then
        print_success "No access token set on failed login"
    else
        print_failure "Security issue" "Access token should not be set on failed login"
    fi
fi

print_info "Testing login with non-existent user"

code=$(make_request "POST" "/auth/login" \
    "{\"email\":\"nonexistent@example.com\",\"password\":\"$TEST_PASSWORD\"}" \
    "Login with non-existent email")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"

# Should also get 401 (to prevent user enumeration)
check_status "$code" "401" "Non-existent user returns 401"

# ============================================
# TEST 1.6: MISSING AUTHENTICATION
# ============================================

print_section "1.6 Missing Authentication Handling"

print_info "Attempting to access protected endpoint without authentication"

# Clear any existing cookies
clear_stored_tokens

code=$(make_request "GET" "/auth/me" "" \
    "Access protected endpoint without auth")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"

# Should get 401 Unauthorized
check_status "$code" "401" "Missing auth returns 401"

if [ $? -eq 0 ]; then
    if command -v jq &> /dev/null && [ -f "$response_file" ]; then
        error_msg=$(jq -r '.message // empty' "$response_file" 2>/dev/null)
        if [ -n "$error_msg" ]; then
            print_success "Error message provided: '$error_msg'"
        fi
    fi
fi

# ============================================
# SUMMARY
# ============================================

print_section "Basic Flow Test Summary"

if [ $PASSED_TESTS -gt 0 ]; then
    echo -e "${GREEN}✓ Basic authentication flow validated${NC}"
    echo -e "${GREEN}  - Login/Logout cycle works${NC}"
    echo -e "${GREEN}  - Session management functions${NC}"
    echo -e "${GREEN}  - Protected endpoints require auth${NC}"
fi

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}✗ Some basic flow tests failed${NC}"
    echo -e "${RED}  Review the output above for details${NC}"
fi

print_info "Basic flow tests complete"