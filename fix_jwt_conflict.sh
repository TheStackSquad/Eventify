#!/bin/bash
set -e

echo "🔧 Fixing JWT Configuration Conflict"
echo "===================================="

echo "1. Cleaning up duplicate key directories..."
# Keep ONLY root directory keys
rm -rf backend/config/keys/ 2>/dev/null || true
echo "✅ Removed backend/config/keys/"

echo ""
echo "2. Fixing duplicate entries in backend/.env..."
# Create backup
cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)

# Remove ALL RSA path entries
sed -i '/^RSA_PRIVATE_KEY_PATH=/d' backend/.env
sed -i '/^RSA_PUBLIC_KEY_PATH=/d' backend/.env

# Add SINGLE correct entry (relative from backend to root)
echo "RSA_PRIVATE_KEY_PATH=../config/keys/private.pem" >> backend/.env
echo "RSA_PUBLIC_KEY_PATH=../config/keys/public.pem" >> backend/.env

echo "✅ backend/.env fixed:"
grep "RSA_" backend/.env

echo ""
echo "3. Verifying key files exist..."
if [ -f "config/keys/private.pem" ] && [ -f "config/keys/public.pem" ]; then
    echo "✅ Keys exist in config/keys/:"
    ls -la config/keys/
else
    echo "❌ Keys missing in config/keys/, generating new ones..."
    mkdir -p config/keys
    chmod 700 config/keys
    openssl genpkey -algorithm RSA -out config/keys/private.pem -pkeyopt rsa_keygen_bits:2048
    openssl rsa -pubout -in config/keys/private.pem -out config/keys/public.pem
    chmod 600 config/keys/private.pem
    chmod 644 config/keys/public.pem
fi

echo ""
echo "4. Creating test to verify path resolution..."
cd backend
cat > test_path.go << 'TESTCODE'
package main

import (
    "fmt"
    "os"
    "path/filepath"
)

func main() {
    paths := []string{
        "./config/keys/private.pem",
        "../config/keys/private.pem",
        os.Getenv("RSA_PRIVATE_KEY_PATH"),
    }
    
    for _, path := range paths {
        absPath, _ := filepath.Abs(path)
        exists := ""
        if _, err := os.Stat(path); err == nil {
            exists = "✅ EXISTS"
        } else {
            exists = "❌ MISSING"
        }
        fmt.Printf("%-40s -> %-60s %s\n", path, absPath, exists)
    }
}
TESTCODE

echo "✅ Test program created"
echo "Running path test:"
go run test_path.go
rm test_path.go
cd ..

echo ""
echo "🎯 Expected result when running server:"
echo "   📁 RSA keys loaded from files"
echo "   ✅ JWT RSA keys loaded and validated"
echo ""
echo "NOT:"
echo "   ⚠️  Generating new RSA keys for development"
