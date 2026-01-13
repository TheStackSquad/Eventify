#!/bin/bash

# JWT Initialization Debug Script
# This script searches for JWT service initialization patterns in your codebase

echo "🔍 JWT Initialization Analysis"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set the backend directory
BACKEND_DIR="./backend"

if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend directory not found!${NC}"
    echo "Please run this script from the eventify root directory"
    exit 1
fi

echo -e "${BLUE}📂 Searching in: $BACKEND_DIR${NC}"
echo ""

# 1. Find all NewJWTService() calls
echo -e "${YELLOW}1️⃣  Searching for NewJWTService() instantiations...${NC}"
echo "---------------------------------------------------"
grep -rn "NewJWTService()" "$BACKEND_DIR" --include="*.go" | while read -r line; do
    echo -e "${GREEN}Found:${NC} $line"
done
echo ""

# 2. Find all Initialize() calls on JWT service
echo -e "${YELLOW}2️⃣  Searching for JWT Initialize() calls...${NC}"
echo "---------------------------------------------------"
grep -rn "\.Initialize()" "$BACKEND_DIR" --include="*.go" | grep -i "jwt\|service" | while read -r line; do
    echo -e "${GREEN}Found:${NC} $line"
done
echo ""

# 3. Check routes configuration
echo -e "${YELLOW}3️⃣  Analyzing routes configuration...${NC}"
echo "---------------------------------------------------"
if [ -f "$BACKEND_DIR/pkg/routes/routes.go" ]; then
    echo -e "${BLUE}Content of routes.go:${NC}"
    grep -n "jwt\|JWT\|NewJWT\|Initialize" "$BACKEND_DIR/pkg/routes/routes.go" -i | while read -r line; do
        echo -e "${GREEN}Line:${NC} $line"
    done
else
    echo -e "${RED}routes.go not found${NC}"
fi
echo ""

# 4. Check middleware files
echo -e "${YELLOW}4️⃣  Checking middleware implementations...${NC}"
echo "---------------------------------------------------"
find "$BACKEND_DIR" -name "*middleware*.go" -type f | while read -r file; do
    echo -e "${BLUE}Checking: $file${NC}"
    grep -n "NewJWTService\|Initialize\|jwt" "$file" -i | while read -r line; do
        echo -e "${GREEN}  $line${NC}"
    done
    echo ""
done

# 5. Check auth handler
echo -e "${YELLOW}5️⃣  Checking auth handler...${NC}"
echo "---------------------------------------------------"
if [ -f "$BACKEND_DIR/pkg/handlers/auth/auth.go" ]; then
    grep -n "NewJWTService\|Initialize" "$BACKEND_DIR/pkg/handlers/auth/auth.go" | while read -r line; do
        echo -e "${GREEN}Found:${NC} $line"
    done
else
    echo -e "${RED}auth handler not found${NC}"
fi
echo ""

# 6. Find all JWT-related structs and interfaces
echo -e "${YELLOW}6️⃣  Searching for JWT service definitions...${NC}"
echo "---------------------------------------------------"
grep -rn "type.*JWT.*Service" "$BACKEND_DIR" --include="*.go" | while read -r line; do
    echo -e "${GREEN}Found:${NC} $line"
done
echo ""

# 7. Check for RSA key loading
echo -e "${YELLOW}7️⃣  Searching for RSA key loading operations...${NC}"
echo "---------------------------------------------------"
grep -rn "LoadPrivateKey\|LoadPublicKey\|RSA.*Load\|ReadFile.*rsa\|ReadFile.*pem" "$BACKEND_DIR" --include="*.go" -i | while read -r line; do
    echo -e "${GREEN}Found:${NC} $line"
done
echo ""

# 8. Summary of files that import JWT service
echo -e "${YELLOW}8️⃣  Files importing JWT service package...${NC}"
echo "---------------------------------------------------"
grep -rn "servicejwt\|services/jwt" "$BACKEND_DIR" --include="*.go" | cut -d: -f1 | sort -u | while read -r file; do
    echo -e "${GREEN}File:${NC} $file"
    echo -e "${BLUE}  Import lines:${NC}"
    grep -n "servicejwt\|services/jwt" "$file"
    echo ""
done

# 9. Check environment variable usage
echo -e "${YELLOW}9️⃣  Checking JWT-related environment variables...${NC}"
echo "---------------------------------------------------"
grep -rn "JWT_\|RSA_" "$BACKEND_DIR" --include="*.go" | grep "Getenv\|LookupEnv" | while read -r line; do
    echo -e "${GREEN}Found:${NC} $line"
done
echo ""

# 10. Final recommendations
echo -e "${BLUE}================================${NC}"
echo -e "${YELLOW}📋 ANALYSIS COMPLETE${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "${GREEN}💡 Next Steps:${NC}"
echo "1. Review the files where NewJWTService() is called"
echo "2. Check if JWT service is being initialized in middleware"
echo "3. Verify RSA key file paths are consistent"
echo "4. Look for duplicate service initialization in routes.go"
echo ""
echo -e "${YELLOW}🔧 Suggested Fix:${NC}"
echo "Pass the already-initialized jwtService from main.go to ConfigureRouter()"
echo "instead of creating a new instance within the router configuration."