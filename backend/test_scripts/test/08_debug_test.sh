#!/bin/bash
# backend/test_scripts/test/08_debug_test.sh

set -x  # Enable debug mode to see every command

echo "Starting debug test..."

# Basic configuration
TEST_DIR="$(dirname "$0")"
LOG_FILE="${TEST_DIR}/debug_test_$(date +%Y%m%d_%H%M%S).txt"

echo "Test directory: $TEST_DIR" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"

# Check if helpers exist
HELPERS_DIR="${TEST_DIR}/helpers"
echo "Checking helpers directory: $HELPERS_DIR" | tee -a "$LOG_FILE"

if [ -d "$HELPERS_DIR" ]; then
    echo "Helpers directory exists" | tee -a "$LOG_FILE"
    ls -la "$HELPERS_DIR/" | tee -a "$LOG_FILE"
else
    echo "ERROR: Helpers directory not found!" | tee -a "$LOG_FILE"
    exit 1
fi

# Source helpers with explicit paths
source "${HELPERS_DIR}/api_helpers.sh"
echo "Sourced api_helpers.sh" | tee -a "$LOG_FILE"

source "${HELPERS_DIR}/db_helpers.sh"
echo "Sourced db_helpers.sh" | tee -a "$LOG_FILE"

# Check API connection
echo "Checking API connection..." | tee -a "$LOG_FILE"
API_BASE_URL="http://localhost:8081"
curl -s "$API_BASE_URL/health" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Check database connection
echo "Checking database connection..." | tee -a "$LOG_FILE"
db_check_connection | tee -a "$LOG_FILE"

echo "Debug test completed" | tee -a "$LOG_FILE"