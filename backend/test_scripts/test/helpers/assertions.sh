#!/bin/bash
# scripts/test/helpers/assertions.sh
# Enhanced test assertion functions with NO external dependencies

# Color codes (self-contained)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Logging functions (duplicated here for self-containment)
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ============================================
# BASIC ASSERTIONS
# ============================================

# Assert equals
# Usage: assert_equals <actual> <expected> <message>
assert_equals() {
    local actual="$1"
    local expected="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$actual" == "$expected" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected: $expected"
        log_error "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert not equals
# Usage: assert_not_equals <actual> <not_expected> <message>
assert_not_equals() {
    local actual="$1"
    local not_expected="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$actual" != "$not_expected" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Should not equal: $not_expected"
        log_error "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert empty (NEW)
# Usage: assert_empty <value> <message>
assert_empty() {
    local value="$1"
    local message="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ -z "$value" ] || [ "$value" == "null" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Should be empty but got: $value"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert not empty (NEW)
# Usage: assert_not_empty <value> <message>
assert_not_empty() {
    local value="$1"
    local message="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected non-empty value but got: '$value'"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert contains
# Usage: assert_contains <haystack> <needle> <message>
assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [[ "$haystack" == *"$needle"* ]]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected to contain: $needle"
        log_error "  In: $haystack"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert not contains (NEW)
# Usage: assert_not_contains <haystack> <needle> <message>
assert_not_contains() {
    local haystack="$1"
    local needle="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [[ "$haystack" != *"$needle"* ]]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Should not contain: $needle"
        log_error "  In: $haystack"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert greater than (NEW)
# Usage: assert_greater_than <actual> <threshold> <message>
assert_greater_than() {
    local actual="$1"
    local threshold="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$actual" -gt "$threshold" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected > $threshold"
        log_error "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert less than (NEW)
# Usage: assert_less_than <actual> <threshold> <message>
assert_less_than() {
    local actual="$1"
    local threshold="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$actual" -lt "$threshold" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected < $threshold"
        log_error "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert greater or equal (NEW)
# Usage: assert_greater_or_equal <actual> <threshold> <message>
assert_greater_or_equal() {
    local actual="$1"
    local threshold="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$actual" -ge "$threshold" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected >= $threshold"
        log_error "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================
# JSON ASSERTIONS (NO JQ DEPENDENCY)
# ============================================

# Assert JSON field equals (NO JQ - uses grep/sed)
# Usage: assert_json_equals <json> <field> <expected> <message>
assert_json_equals() {
    local json="$1"
    local field="$2"
    local expected="$3"
    local message="$4"
    
    # Extract value using grep/sed (no jq)
    local actual=$(echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | sed "s/\"$field\":\"\(.*\)\"/\1/" | head -n 1)
    
    # Handle numeric values
    if [ -z "$actual" ]; then
        actual=$(echo "$json" | grep -o "\"$field\":[0-9]*" | sed "s/\"$field\":\(.*\)/\1/" | head -n 1)
    fi
    
    assert_equals "$actual" "$expected" "$message"
}

# Assert JSON field exists (NO JQ)
# Usage: assert_json_exists <json> <field> <message>
assert_json_exists() {
    local json="$1"
    local field="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if echo "$json" | grep -q "\"$field\""; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Field does not exist: $field"
        log_error "  In JSON: $json"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert JSON field not exists (NEW)
# Usage: assert_json_not_exists <json> <field> <message>
assert_json_not_exists() {
    local json="$1"
    local field="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if ! echo "$json" | grep -q "\"$field\""; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Field should not exist: $field"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert HTTP status (ENHANCED - no jq dependency)
# Usage: assert_status <response> <expected_status> <message>
assert_status() {
    local response="$1"
    local expected="$2"
    local message="$3"
    
    # Try to extract status field
    local status=$(echo "$response" | grep -o "\"status\":\"[^\"]*\"" | sed 's/"status":"\(.*\)"/\1/' | head -n 1)
    
    # If not found, try numeric status
    if [ -z "$status" ]; then
        status=$(echo "$response" | grep -o "\"status\":[0-9]*" | sed 's/"status":\(.*\)/\1/' | head -n 1)
    fi
    
    assert_equals "$status" "$expected" "$message"
}

# ============================================
# DATABASE ASSERTIONS
# ============================================

# Assert order status in database
# Usage: assert_db_order_status <reference> <expected_status> <message>
assert_db_order_status() {
    local reference="$1"
    local expected="$2"
    local message="$3"
    
    local actual=$(db_get_order_status "$reference")
    assert_equals "$actual" "$expected" "$message"
}

# Assert tickets created (ENHANCED with better error message)
# Usage: assert_tickets_created <order_id> <expected_count> <message>
assert_tickets_created() {
    local order_id="$1"
    local expected="$2"
    local message="$3"
    
    local actual=$(db_count_tickets "$order_id")
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$actual" == "$expected" ]; then
        log_success "PASS: $message (found $actual tickets)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected: $expected tickets"
        log_error "  Actual: $actual tickets"
        log_error "  Order ID: $order_id"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert stock level (NEW)
# Usage: assert_stock_level <tier_id> <expected> <message>
assert_stock_level() {
    local tier_id="$1"
    local expected="$2"
    local message="$3"
    
    local actual=$(db_get_stock "$tier_id")
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$actual" == "$expected" ]; then
        log_success "PASS: $message (stock: $actual)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected stock: $expected"
        log_error "  Actual stock: $actual"
        log_error "  Tier ID: $tier_id"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert stock not negative (NEW)
# Usage: assert_stock_not_negative <tier_id> <message>
assert_stock_not_negative() {
    local tier_id="$1"
    local message="$2"
    
    local stock=$(db_get_stock "$tier_id")
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$stock" -ge 0 ]; then
        log_success "PASS: $message (stock: $stock)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Stock is NEGATIVE: $stock"
        log_error "  Tier ID: $tier_id"
        log_error "  CRITICAL: This should never happen!"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================
# UTILITY ASSERTIONS
# ============================================

# Assert true
# Usage: assert_true <condition_result> <message>
assert_true() {
    local condition="$1"
    local message="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$condition" == "true" ] || [ "$condition" == "0" ] || [ "$condition" == "1" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected true, got: $condition"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert false
# Usage: assert_false <condition_result> <message>
assert_false() {
    local condition="$1"
    local message="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$condition" == "false" ] || [ "$condition" == "" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  Expected false, got: $condition"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Assert file exists
# Usage: assert_file_exists <filepath> <message>
assert_file_exists() {
    local filepath="$1"
    local message="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ -f "$filepath" ]; then
        log_success "PASS: $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "FAIL: $message"
        log_error "  File does not exist: $filepath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================
# TEST SUMMARY & REPORTING
# ============================================

# Print test summary
print_test_summary() {
    echo ""
    echo "========================================"
    echo "TEST SUMMARY"
    echo "========================================"
    echo "Total tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_RUN -gt 0 ]; then
        echo -e "${GREEN}Success Rate: 100%${NC}"
    elif [ $TESTS_RUN -gt 0 ]; then
        local success_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
        echo -e "${YELLOW}Success Rate: ${success_rate}%${NC}"
    fi
    
    echo "========================================"
    
    if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_RUN -gt 0 ]; then
        log_success "ALL TESTS PASSED ✓"
        return 0
    elif [ $TESTS_RUN -eq 0 ]; then
        log_warning "NO TESTS RUN"
        return 1
    else
        log_error "SOME TESTS FAILED ✗"
        return 1
    fi
}

# Print detailed test summary (NEW)
print_detailed_summary() {
    echo ""
    echo "=========================================="
    echo "DETAILED TEST SUMMARY"
    echo "=========================================="
    echo "Tests Run:     $TESTS_RUN"
    echo -e "${GREEN}Passed:        $TESTS_PASSED${NC}"
    echo -e "${RED}Failed:        $TESTS_FAILED${NC}"
    
    if [ $TESTS_RUN -gt 0 ]; then
        local pass_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
        local fail_rate=$((TESTS_FAILED * 100 / TESTS_RUN))
        
        echo ""
        echo "Pass Rate:     ${pass_rate}%"
        echo "Fail Rate:     ${fail_rate}%"
    fi
    
    echo "=========================================="
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_RUN -gt 0 ]; then
        echo -e "${GREEN}🎉 PERFECT SCORE! All tests passed!${NC}"
        return 0
    elif [ $TESTS_RUN -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No tests were executed${NC}"
        return 1
    else
        echo -e "${RED}❌ ${TESTS_FAILED} test(s) failed${NC}"
        echo -e "${YELLOW}Please review the failures above${NC}"
        return 1
    fi
}

# Reset test counters
reset_test_counters() {
    TESTS_RUN=0
    TESTS_PASSED=0
    TESTS_FAILED=0
}

# Get test results (NEW - for programmatic access)
get_test_results() {
    echo "$TESTS_RUN,$TESTS_PASSED,$TESTS_FAILED"
}

# Export all functions
export -f log_success log_error log_info log_warning
export -f assert_equals assert_not_equals
export -f assert_empty assert_not_empty
export -f assert_contains assert_not_contains
export -f assert_greater_than assert_less_than assert_greater_or_equal
export -f assert_json_equals assert_json_exists assert_json_not_exists
export -f assert_status
export -f assert_db_order_status assert_tickets_created
export -f assert_stock_level assert_stock_not_negative
export -f assert_true assert_false assert_file_exists
export -f print_test_summary print_detailed_summary
export -f reset_test_counters get_test_results