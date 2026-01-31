#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

TARGET_PORTS=(3000 3001 8080 8081)
COUNT=0

echo -e "${CYAN}🚀 Initializing Windows-Aware Port Cleanup...${NC}"

for PORT in "${TARGET_PORTS[@]}"; do
    # Using netstat to find the Windows PID listening on the port
    # 'LISTENING' filters for active servers
    WIN_PID=$(netstat -ano | grep ":$PORT " | grep "LISTENING" | awk '{print $5}' | sort -u | tr -d '\r')

    if [ -n "$WIN_PID" ]; then
        for PID in $WIN_PID; do
            # Get the process name using tasklist
            P_NAME=$(tasklist /FI "PID eq $PID" /NH | awk '{print $1}')
            
            echo -e "${YELLOW}⚠️  Found $P_NAME on port $PORT (PID: $PID). Killing...${NC}"
            
            # /F is force, /T kills child processes (important for Node/Next.js)
            if taskkill //F //PID $PID > /dev/null 2>&1; then
                echo -e "  ${GREEN}Successfully terminated $P_NAME${NC}"
                ((COUNT++))
            else
                echo -e "  ${RED}✖ Failed to kill PID $PID${NC}"
            fi
        done
    else
        echo -e "  ${GREEN}✔${NC} Port $PORT is clear."
    fi
done

echo -e "\n${CYAN}--- Final Status ---${NC}"
if [ $COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ No active processes were found.${NC}"
else
    echo -e "${GREEN}✅ Successfully cleared $COUNT process(es).${NC}"
fi