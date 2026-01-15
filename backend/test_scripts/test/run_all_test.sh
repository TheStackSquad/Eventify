#!/bin/bash
# scripts/test/run_all_tests.sh
# Master test runner for comprehensive order-to-ticket testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

# Test configuration
RUN_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
MASTER_LOG="$LOG_DIR/test_run_${RUN_TIMESTAMP}.log"

# Color codes
BOLD='\033[1m'
UNDERLINE='\033[4m'
NC='\033[0m'

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Banner
print_banner() {
    echo ""
    echo "=========================================="
    echo -e "${BOLD}${UNDERLINE}EVENTIFY TEST SUITE${NC}"
    echo "Order-to-Ticket Atomic Logic Verification"
    echo "=========================================="
    echo "Started: $(date)"
    echo "Log file: $MASTER_LOG"
    echo ""
}

# Run a single test file
run_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .sh)
    
    echo "" | tee -a "$MASTER_LOG"
    log_info "Running: $test_name" | tee -a "$MASTER_LOG"
    echo "----------------------------------------" | tee -a "$MASTER_LOG"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$test_file" ] && [ -x "$test_file" ]; then
        local test_log="$LOG_DIR/${test_name}_${RUN_TIMESTAMP}.log"
        
        if "$test_file" > "$test_log" 2>&1; then
            log_success "✓ $test_name PASSED" | tee -a "$MASTER_LOG"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            
            # Show summary from test
            tail -n 5 "$test_log" | tee -a "$MASTER_LOG"
        else
            log_error "✗ $test_name FAILED" | tee -a "$MASTER_LOG"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            
            # Show last 20 lines of failed test
            echo "Last 20 lines of output:" | tee -a "$MASTER_LOG"
            tail -n 20 "$test_log" | tee -a "$MASTER_LOG"
        fi
        
        echo "Full log: $test_log" | tee -a "$MASTER_LOG"
    else
        log_warning "✓ $test_name SKIPPED (not found or not executable)" | tee -a "$MASTER_LOG"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    fi
}

# Pre-flight checks
pre_flight_checks() {
    echo "" | tee -a "$MASTER_LOG"
    log_info "Pre-flight Checks" | tee -a "$MASTER_LOG"
    echo "----------------------------------------" | tee -a "$MASTER_LOG"
    
    # Check API is running
    log_info "Checking API connection..." | tee -a "$MASTER_LOG"
    if health_check > /dev/null 2>&1; then
        log_success "✓ API is running" | tee -a "$MASTER_LOG"
    else
        log_error "✗ API is not responding" | tee -a "$MASTER_LOG"
        log_error "Please start the backend server first" | tee -a "$MASTER_LOG"
        exit 1
    fi
    
    # Check database connection
    log_info "Checking database connection..." | tee -a "$MASTER_LOG"
    if db_check_connection 2>&1 | tee -a "$MASTER_LOG"; then
        log_success "✓ Database is connected" | tee -a "$MASTER_LOG"
    else
        log_error "✗ Database connection failed" | tee -a "$MASTER_LOG"
        exit 1
    fi
    
    # Check for test data
    log_info "Checking test data..." | tee -a "$MASTER_LOG"
    event_count=$(db_query "SELECT COUNT(*) FROM events WHERE status = 'published'" | tail -n 1)
    tier_count=$(db_query "SELECT COUNT(*) FROM ticket_tiers WHERE available > 0" | tail -n 1)
    
    log_info "Found $event_count published events" | tee -a "$MASTER_LOG"
    log_info "Found $tier_count tiers with available tickets" | tee -a "$MASTER_LOG"
    
    if [ "$event_count" -eq 0 ] || [ "$tier_count" -eq 0 ]; then
        log_warning "Limited test data - some tests may be skipped" | tee -a "$MASTER_LOG"
    else
        log_success "✓ Test data available" | tee -a "$MASTER_LOG"
    fi
    
    echo "" | tee -a "$MASTER_LOG"
}

# Post-flight cleanup
post_flight_cleanup() {
    echo "" | tee -a "$MASTER_LOG"
    log_info "Post-flight Cleanup" | tee -a "$MASTER_LOG"
    echo "----------------------------------------" | tee -a "$MASTER_LOG"
    
    # Clean up test orders
    log_info "Cleaning up test data..." | tee -a "$MASTER_LOG"
    db_cleanup_test_orders 2>&1 | tee -a "$MASTER_LOG"
}

# Generate final report
generate_report() {
    echo "" | tee -a "$MASTER_LOG"
    echo "==========================================" | tee -a "$MASTER_LOG"
    echo -e "${BOLD}TEST SUMMARY${NC}" | tee -a "$MASTER_LOG"
    echo "==========================================" | tee -a "$MASTER_LOG"
    echo "Total Tests:   $TOTAL_TESTS" | tee -a "$MASTER_LOG"
    echo "Passed:        $PASSED_TESTS" | tee -a "$MASTER_LOG"
    echo "Failed:        $FAILED_TESTS" | tee -a "$MASTER_LOG"
    echo "Skipped:       $SKIPPED_TESTS" | tee -a "$MASTER_LOG"
    echo "==========================================" | tee -a "$MASTER_LOG"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "🎉 ALL TESTS PASSED!" | tee -a "$MASTER_LOG"
        echo "" | tee -a "$MASTER_LOG"
        echo "Your order-to-ticket logic is SOLID!" | tee -a "$MASTER_LOG"
        echo "✓ Atomic transactions verified" | tee -a "$MASTER_LOG"
        echo "✓ Idempotency verified" | tee -a "$MASTER_LOG"
        echo "✓ Race conditions handled" | tee -a "$MASTER_LOG"
        echo "✓ Stock consistency maintained" | tee -a "$MASTER_LOG"
        echo "✓ Webhook integration verified" | tee -a "$MASTER_LOG"
    else
        log_error "❌ SOME TESTS FAILED" | tee -a "$MASTER_LOG"
        echo "" | tee -a "$MASTER_LOG"
        echo "Please review the logs for failed tests:" | tee -a "$MASTER_LOG"
        ls -lt "$LOG_DIR" | head -n 10 | tee -a "$MASTER_LOG"
    fi
    
    echo "" | tee -a "$MASTER_LOG"
    echo "Completed: $(date)" | tee -a "$MASTER_LOG"
    echo "Master log: $MASTER_LOG" | tee -a "$MASTER_LOG"
    echo "==========================================" | tee -a "$MASTER_LOG"
    echo "" | tee -a "$MASTER_LOG"
}

# Main execution
main() {
    print_banner
    
    # Run pre-flight checks
    pre_flight_checks
    
    # List of test files to run
    TESTS=(
        "$SCRIPT_DIR/01_test_order_init_enhanced.sh"
        "$SCRIPT_DIR/02_test_payment_verify_enhanced.sh"
        "$SCRIPT_DIR/03_test_idempotency_stress.sh"
        "$SCRIPT_DIR/04_test_webhook_scenarios.sh"
        "$SCRIPT_DIR/05_test_stock_consistency.sh"
    )
    
    # Run each test
    for test in "${TESTS[@]}"; do
        run_test "$test"
    done
    
    # Cleanup
    post_flight_cleanup
    
    # Generate report
    generate_report
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Parse command line arguments
CLEANUP_ONLY=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --cleanup-only)
            CLEANUP_ONLY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --cleanup-only    Only run cleanup, don't run tests"
            echo "  --dry-run         Check setup without running tests"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Handle special modes
if [ "$CLEANUP_ONLY" = true ]; then
    print_banner
    post_flight_cleanup
    exit 0
fi

if [ "$DRY_RUN" = true ]; then
    print_banner
    pre_flight_checks
    log_info "Dry run complete - system is ready for testing"
    exit 0
fi

# Run main test suite
main