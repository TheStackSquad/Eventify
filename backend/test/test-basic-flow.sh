#!/bin/bash
# backend/test/test-basic-flow.sh
# Tests the fundamental login, session check, and logout endpoints.

print_header "1. BASIC AUTHENTICATION FLOW"

# Test 1.1: Login
code=$(make_request "POST" "/auth/login" \
    "{\"email\":\"$TEST_USER_1\",\"password\":\"$TEST_PASSWORD\"}" \
    "Login with existing user")

response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
check_status "$code" "200" "Login successful"

# Debug: Show what we got
if [ -n "$CURRENT_ACCESS_TOKEN" ]; then
    print_info "Access token available (${#CURRENT_ACCESS_TOKEN} chars)"
else
    print_warning "No access token stored"
fi

# Test 1.2: Verify /me endpoint
code=$(make_request "GET" "/auth/me" "" \
    "Get current user")

check_status "$code" "200" "Current user retrieved"

# Test 1.3: Logout
code=$(make_request "POST" "/auth/logout" "" \
    "Logout")

check_status "$code" "200" "Logout successful"

# Clear stored tokens after logout
clear_stored_tokens