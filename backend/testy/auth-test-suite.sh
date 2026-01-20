#!/bin/bash

# backend/test/auth-test-suite.sh
# Main entry point for the Enhanced Authentication Test Suite.
# Usage: ./auth-test-suite.sh [BASE_URL] [--debug]
# Example: ./auth-test-suite.sh http://localhost:8081
# Example: ./auth-test-suite.sh http://localhost:8081 --debug

# ============================================
# PARSE ARGUMENTS
# ============================================
BASE_URL="http://localhost:8081"
DEBUG_MODE=false

for arg in "$@"; do
    case $arg in
        --debug)
            DEBUG_MODE=true
            set -x  # Enable bash debug mode
            shift
            ;;
        http*)
            BASE_URL="$arg"
            shift
            ;;
        *)
            ;;
    esac
done

# ============================================
# CONFIGURATION
# ============================================
COOKIE_JAR="$(mktemp)"
OUTPUT_DIR="$(mktemp -d)"

# Use existing test users from your database
TEST_USER_1="constellar@events.com"
TEST_USER_2="arike@events.com"
TEST_PASSWORD="passWord123"

# ============================================
# SOURCE HELPERS AND INITIALIZE
# ============================================

if [ ! -f "./test-helpers.sh" ]; then
    echo "ERROR: test-helpers.sh not found in current directory"
    exit 1
fi

source ./test-helpers.sh

print_header "ENHANCED AUTH API TEST SUITE - WEEK 1 & 2 VALIDATION"
print_info "Testing against: $BASE_URL"
print_info "Cookie jar: $COOKIE_JAR"
print_info "Output directory: $OUTPUT_DIR"
print_info "Test User 1: $TEST_USER_1"
print_info "Test User 2: $TEST_USER_2"
if [ "$DEBUG_MODE" = true ]; then
    print_info "DEBUG MODE ENABLED"
fi

# ============================================
# RUN INDIVIDUAL TEST FILES
# ============================================

print_header "RUNNING TEST SECTIONS"

TEST_FILES=(
    "./test-basic-flow.sh"
    "./test-token-rotation.sh"
    "./test-security.sh"
    "./test-cleanup-edge.sh"
)

for test_file in "${TEST_FILES[@]}"; do
    if [ -f "$test_file" ]; then
        if [ "$DEBUG_MODE" = true ]; then
            print_info "=== Loading test file: $test_file ==="
        fi
        
        # Source the file and catch any errors
        if source "$test_file" 2>&1; then
            if [ "$DEBUG_MODE" = true ]; then
                print_info "=== Completed: $test_file ==="
            fi
        else
            exit_code=$?
            print_warning "Test file $test_file exited with code $exit_code, continuing..."
        fi
        
        # Add delay between test sections to avoid overwhelming backend
        print_info "Waiting 2s before next test section..."
        sleep 2
    else
        print_warning "Test file not found: $test_file (skipping)"
    fi
done

# ============================================
# FINAL SUMMARY AND CLEANUP
# ============================================

print_header "TEST SUMMARY"

# Calculate skipped tests (rate limited)
SKIPPED_TESTS=$((TOTAL_TESTS - PASSED_TESTS - FAILED_TESTS))

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Total Tests:   ${NC}${TOTAL_TESTS}"
echo -e "${GREEN}Passed:        ${NC}${PASSED_TESTS}"
echo -e "${RED}Failed:        ${NC}${FAILED_TESTS}"
if [ $SKIPPED_TESTS -gt 0 ]; then
    echo -e "${MAGENTA}Skipped:       ${NC}${SKIPPED_TESTS} (rate limited)"
fi
echo -e "${BLUE}═══════════════════════════════════════${NC}"

if [ $TOTAL_TESTS -eq 0 ]; then
    echo -e "\n${RED}⚠ NO TESTS WERE RUN${NC}\n"
    SUCCESS_RATE=0
elif [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✓✓✓ ALL TESTS PASSED! ✓✓✓${NC}"
    echo -e "${GREEN}✓ Week 1 & 2 Enhancements Successfully Validated${NC}\n"
    SUCCESS_RATE=100
else
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "\n${YELLOW}⚠ Some tests failed (${SUCCESS_RATE}% success rate)${NC}"
    echo -e "${YELLOW}Review the output above for details${NC}\n"
fi

print_header "CLEANUP"

print_info "Response files saved in: $OUTPUT_DIR"
print_info "Cookie jar saved in: $COOKIE_JAR"

if [ "$DEBUG_MODE" = true ]; then
    print_info "DEBUG: Listing response files:"
    ls -lh "$OUTPUT_DIR"/ 2>/dev/null || echo "  (no files)"
fi

echo ""
read -p "Delete temporary files? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$OUTPUT_DIR"
    rm -f "$COOKIE_JAR"
    rm -f "${COOKIE_JAR}.device1"
    rm -f "${COOKIE_JAR}.temp"
    rm -f "${COOKIE_JAR}.saved"
    print_success "Temporary files deleted"
else
    print_info "Temporary files preserved for inspection"
    echo -e "${CYAN}Cookie jar: ${NC}$COOKIE_JAR"
    echo -e "${CYAN}Output dir: ${NC}$OUTPUT_DIR"
    echo -e "${CYAN}View responses: ${NC}ls $OUTPUT_DIR/"
fi

echo ""
print_header "TEST RUN COMPLETE"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ] && [ $TOTAL_TESTS -gt 0 ]; then
    exit 0
else
    exit 1
fi