# Update the setup script with CORRECT paths
cat > scripts/setup_jwt_env.sh << 'EOF'
#!/bin/bash
set -e

echo "🔧 Setting up JWT Environment (Production-Ready)"
echo "================================================"

# Create config directory in ROOT
echo "1. Creating config/keys directory in project root..."
mkdir -p config/keys
chmod 700 config/keys

# Check if keys already exist
if [ -f "config/keys/private.pem" ] && [ -f "config/keys/public.pem" ]; then
    echo "✅ RSA keys already exist in config/keys/"
    echo "   Permissions:"
    ls -la config/keys/ | grep "\.pem"
else
    echo "2. Generating new 2048-bit RSA keys..."
    openssl genpkey -algorithm RSA -out config/keys/private.pem -pkeyopt rsa_keygen_bits:2048
    openssl rsa -pubout -in config/keys/private.pem -out config/keys/public.pem
    chmod 600 config/keys/private.pem
    chmod 644 config/keys/public.pem
    echo "✅ RSA keys generated and saved to config/keys/"
fi

echo ""
echo "3. Configuring environment files..."
echo "   IMPORTANT: Paths are relative to where server runs (backend/)"

# Configure BACKEND .env file (where server runs from)
echo ""
echo "   a) Configuring backend/.env file..."
if [ -f "backend/.env" ]; then
    # Create backup
    cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Remove old RSA entries
    sed -i '/^RSA_PRIVATE_KEY_PATH=/d' backend/.env 2>/dev/null || true
    sed -i '/^RSA_PUBLIC_KEY_PATH=/d' backend/.env 2>/dev/null || true
    sed -i '/^RSA_PRIVATE_KEY=/d' backend/.env 2>/dev/null || true
    sed -i '/^RSA_PUBLIC_KEY=/d' backend/.env 2>/dev/null || true
else
    echo "   ⚠️  backend/.env not found, creating basic one..."
fi

# Add CORRECT paths (relative from backend to root)
echo "RSA_PRIVATE_KEY_PATH=../config/keys/private.pem" >> backend/.env
echo "RSA_PUBLIC_KEY_PATH=../config/keys/public.pem" >> backend/.env
echo "   ✅ backend/.env configured with relative paths to root"

# Also create/update root .env for reference
echo ""
echo "   b) Configuring root .env for documentation..."
echo "RSA_PRIVATE_KEY_PATH=../config/keys/private.pem" > .env.sample
echo "RSA_PUBLIC_KEY_PATH=../config/keys/public.pem" >> .env.sample
echo "   ✅ Created .env.sample for reference"

echo ""
echo "4. Verification test..."
cd backend
echo "   Current directory: $(pwd)"
echo "   RSA_PRIVATE_KEY_PATH resolves to: $(realpath ../config/keys/private.pem 2>/dev/null || echo '../config/keys/private.pem')"
if [ -f "../config/keys/private.pem" ]; then
    echo "   ✅ Key file found!"
else
    echo "   ❌ Key file NOT found at expected location"
fi
cd ..

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📋 Directory Structure:"
echo "   eventify/config/keys/              ← RSA keys stored here"
echo "   eventify/backend/.env              ← Config (points to ../config/keys/)"
echo ""
echo "🚀 To start server:"
echo "   cd backend && go run main.go"
echo ""
echo "Expected output:"
echo "   📁 RSA keys loaded from files"
echo "   ✅ JWT RSA keys loaded and validated"
EOF