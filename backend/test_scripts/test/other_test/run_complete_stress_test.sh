#!/bin/bash
# backend/test_scripts/test/run_complete_stress_test.sh
# MASTER TEST SUITE RUNNER
# Executes all atomic flow tests and generates comprehensive report

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MASTER_LOG="$SCRIPT_DIR/logs/MASTER_TEST_${TIMESTAMP}.log"
REPORT_FILE="$SCRIPT_DIR/logs/MASTER_REPORT_${TIMESTAMP}.txt"

mkdir -p "$SCRIPT_DIR/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Test Suite Configuration
declare -a TEST_SUITES=(
    "00_atomic_flow_stress_test.sh|Atomic Flow End-to-End|CRITICAL"
    "08_stock_atomicity_stress.sh|Stock Atomicity Deep Dive|CRITICAL"
    "09_failure_recovery_stress.sh|Failure Recovery & Edge Cases|CRITICAL"
    "01_test_order_init.sh|Order Initialization|HIGH"
    "02_test_payment_verify.sh|Payment Verification|HIGH"
    "03_test_idempotency.sh|Idempotency Checks|HIGH"
    "04_test_concurrent.sh|Concurrent Requests|MEDIUM"
    "07_test_webhook.sh|Webhook Processing|MEDIUM"
)

# Metrics
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SKIPPED_SUITES=0
START_TIME=$(date +%s)

# ============================================================================
# LOGGING & DISPLAY
# ============================================================================

print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║        EVENTIFY PAYMENT GATEWAY - STRESS TEST SUITE          ║"
    echo "║                                                               ║"
    echo "║              Atomic Flow Validation & Testing                ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${BLUE}Test Run ID:${NC} $TIMESTAMP"
    echo -e "${BLUE}Master Log:${NC} $MASTER_LOG"
    echo -e "${BLUE}Report File:${NC} $REPORT_FILE"
    echo ""
}

print_section() {
    local title="$1"
    echo "" | tee -a "$MASTER_LOG"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$MASTER_LOG"
    echo -e "${MAGENTA}  $title${NC}" | tee -a "$MASTER_LOG"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$MASTER_LOG"
    echo "" | tee -a "$MASTER_LOG"
}

log_suite_start() {
    local name="$1"
    local priority="$2"
    echo -e "${BLUE}▶ Running:${NC} $name ${YELLOW}[Priority: $priority]${NC}" | tee -a "$MASTER_LOG"
}

log_suite_result() {
    local name="$1"
    local status="$2"
    local duration="$3"
    
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    
    if [ "$status" = "PASS" ]; then
        PASSED_SUITES=$((PASSED_SUITES + 1))
        echo -e "${GREEN}✓ $name: PASSED${NC} (${duration}s)" | tee -a "$MASTER_LOG"
    elif [ "$status" = "FAIL" ]; then
        FAILED_SUITES=$((FAILED_SUITES + 1))
        echo -e "${RED}✗ $name: FAILED${NC} (${duration}s)" | tee -a "$MASTER_LOG"
    else
        SKIPPED_SUITES=$((SKIPPED_SUITES + 1))
        echo -e "${YELLOW}⊘ $name: SKIPPED${NC}" | tee -a "$MASTER_LOG"
    fi
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

run_preflight_checks() {
    print_section "PRE-FLIGHT CHECKS"
    
    local checks_passed=true
    
    # Check 1: Database Connection
    echo -n "  Checking database connection... " | tee -a "$MASTER_LOG"
    if command -v psql &> /dev/null; then
        # Load DB config
     ENV_PATH="$SCRIPT_DIR/../../.env"

if [ -f "$ENV_PATH" ]; then
    # Read the file line by line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # 1. Skip lines starting with #
        # 2. Skip empty lines
        if [[ ! "$line" =~ ^# && -n "$line" ]]; then
            export "$line"
        fi
    done < "$ENV_PATH"
fi
        
        if PGPASSWORD=${DB_PASSWORD:-postgres} psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} \
           -U ${DB_USER:-postgres} -d ${DB_NAME:-eventify_db} -c "SELECT 1" &>/dev/null; then
            echo -e "${GREEN}✓${NC}" | tee -a "$MASTER_LOG"
        else
            echo -e "${RED}✗ Failed${NC}" | tee -a "$MASTER_LOG"
            checks_passed=false
        fi
    else
        echo -e "${YELLOW}⊘ psql not found${NC}" | tee -a "$MASTER_LOG"
    fi
    
    # Check 2: API Server
    echo -n "  Checking API server... " | tee -a "$MASTER_LOG"
    if curl -s "${API_BASE_URL:-http://localhost:8081}/health" &>/dev/null; then
        echo -e "${GREEN}✓${NC}" | tee -a "$MASTER_LOG"
    else
        echo -e "${RED}✗ Not responding${NC}" | tee -a "$MASTER_LOG"
        checks_passed=false
    fi
    
    # Check 3: Required Tools
    echo -n "  Checking required tools (curl, jq)... " | tee -a "$MASTER_LOG"
    if command -v curl &>/dev/null && command -v jq &>/dev/null; then
        echo -e "${GREEN}✓${NC}" | tee -a "$MASTER_LOG"
    else
        echo -e "${RED}✗ Missing tools${NC}" | tee -a "$MASTER_LOG"
        checks_passed=false
    fi
    
    # Check 4: Test Scripts Exist
    echo -n "  Checking test scripts... " | tee -a "$MASTER_LOG"
    local missing_scripts=0
    for suite_info in "${TEST_SUITES[@]}"; do
        local script=$(echo "$suite_info" | cut -d'|' -f1)
        if [ ! -f "$SCRIPT_DIR/$script" ]; then
            missing_scripts=$((missing_scripts + 1))
        fi
    done
    
    if [ $missing_scripts -eq 0 ]; then
        echo -e "${GREEN}✓${NC}" | tee -a "$MASTER_LOG"
    else
        echo -e "${YELLOW}⊘ $missing_scripts missing${NC}" | tee -a "$MASTER_LOG"
    fi
    
    echo "" | tee -a "$MASTER_LOG"
    
    if [ "$checks_passed" = false ]; then
        echo -e "${RED}⚠ Pre-flight checks failed. Continue anyway? (y/N)${NC}"
        read -r response
        if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
            echo "Aborted." | tee -a "$MASTER_LOG"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ All pre-flight checks passed${NC}" | tee -a "$MASTER_LOG"
    fi
}

# ============================================================================
# RUN TEST SUITES
# ============================================================================

run_test_suites() {
    print_section "EXECUTING TEST SUITES"
    
    for suite_info in "${TEST_SUITES[@]}"; do
        IFS='|' read -r script name priority <<< "$suite_info"
        
        if [ ! -f "$SCRIPT_DIR/$script" ]; then
            log_suite_result "$name" "SKIP" "0"
            continue
        fi
        
        log_suite_start "$name" "$priority"
        
        local start=$(date +%s)
        
        # Make script executable
        chmod +x "$SCRIPT_DIR/$script"
        
        # Run test and capture output
        local output_file="/tmp/${script}_${TIMESTAMP}.log"
        if bash "$SCRIPT_DIR/$script" > "$output_file" 2>&1; then
            local status="PASS"
        else
            local status="FAIL"
        fi
        
        local end=$(date +%s)
        local duration=$((end - start))
        
        # Append to master log
        echo "--- $name Output ---" >> "$MASTER_LOG"
        cat "$output_file" >> "$MASTER_LOG"
        echo "--- End Output ---" >> "$MASTER_LOG"
        
        log_suite_result "$name" "$status" "$duration"
        
        # Brief pause between suites
        sleep 1
    done
}

# ============================================================================
# GENERATE COMPREHENSIVE REPORT
# ============================================================================

generate_report() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    local minutes=$((total_duration / 60))
    local seconds=$((total_duration % 60))
    
    print_section "TEST SUMMARY"
    
    # Create report
    cat > "$REPORT_FILE" <<EOF
═══════════════════════════════════════════════════════════════
           EVENTIFY PAYMENT GATEWAY STRESS TEST REPORT
═══════════════════════════════════════════════════════════════

Generated: $(date)
Test Run ID: $TIMESTAMP
Total Duration: ${minutes}m ${seconds}s

───────────────────────────────────────────────────────────────
TEST SUITE RESULTS
───────────────────────────────────────────────────────────────

Total Suites: $TOTAL_SUITES
Passed: $PASSED_SUITES
Failed: $FAILED_SUITES
Skipped: $SKIPPED_SUITES

Success Rate: $(awk "BEGIN {printf \"%.1f\", ($PASSED_SUITES/$TOTAL_SUITES)*100}")%

EOF
    
    # Display summary
    cat "$REPORT_FILE"
    
    # Overall status
    echo "───────────────────────────────────────────────────────────────" | tee -a "$REPORT_FILE"
    if [ $FAILED_SUITES -eq 0 ]; then
        echo -e "${GREEN}" | tee -a "$REPORT_FILE"
        echo "   ✓✓✓ ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION ✓✓✓" | tee -a "$REPORT_FILE"
        echo -e "${NC}" | tee -a "$REPORT_FILE"
    elif [ $FAILED_SUITES -le 2 ]; then
        echo -e "${YELLOW}" | tee -a "$REPORT_FILE"
        echo "   ⚠ MINOR ISSUES DETECTED - REVIEW REQUIRED" | tee -a "$REPORT_FILE"
        echo -e "${NC}" | tee -a "$REPORT_FILE"
    else
        echo -e "${RED}" | tee -a "$REPORT_FILE"
        echo "   ✗ CRITICAL FAILURES - DO NOT DEPLOY" | tee -a "$REPORT_FILE"
        echo -e "${NC}" | tee -a "$REPORT_FILE"
    fi
    echo "═══════════════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
    
    echo "" | tee -a "$REPORT_FILE"
    echo "Detailed logs: $MASTER_LOG" | tee -a "$REPORT_FILE"
    echo "Report saved: $REPORT_FILE" | tee -a "$REPORT_FILE"
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup_temp_files() {
    echo "" | tee -a "$MASTER_LOG"
    echo "Cleaning up temporary files..." | tee -a "$MASTER_LOG"
    rm -f /tmp/*_${TIMESTAMP}.log
    rm -f /tmp/race_*.json /tmp/verify_*.json /tmp/stress_*.status
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    print_header
    
    # Record start
    echo "Test suite started at $(date)" > "$MASTER_LOG"
    
    # Execute
    run_preflight_checks
    run_test_suites
    
    # Report
    generate_report
    
    # Cleanup
    cleanup_temp_files
    
    # Exit code
    if [ $FAILED_SUITES -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Trap for cleanup on interrupt
trap 'echo "Test interrupted"; cleanup_temp_files; exit 130' INT TERM

main "$@"