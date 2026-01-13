cat > scripts/init_keys.sh << 'EOF'
#!/bin/bash
set -e

echo "🔑 Initial RSA Key Setup"
echo "========================"
echo "Use this for:"
echo "• New development environment"
echo "• Production server setup"
echo "• Disaster recovery"
echo ""

echo "1. Setting up directory structure..."
mkdir -p config/keys
chmod 700 config/keys

echo "2. Checking for existing keys..."
if [ -f "config/keys/private.pem" ]; then
    echo "   ⚠️  RSA keys already exist in config/keys/"
    echo "   Current permissions:"
    ls -la config/keys/
    
    read -p "   Overwrite existing keys? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled - keys preserved"
        exit 0
    fi
    echo "   Will overwrite existing keys..."
fi

echo ""
echo "3. Generating new 2048-bit RSA key pair..."
openssl genpkey -algorithm RSA -out config/keys/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in config/keys/private.pem -out config/keys/public.pem

echo "4. Setting secure permissions..."
chmod 600 config/keys/private.pem
chmod 644 config/keys/public.pem

echo ""
echo "5. Validating key pair..."
echo "test" > test_validate.txt
openssl pkeyutl -encrypt -in test_validate.txt -out test_validate.enc -pubin -inkey config/keys/public.pem
openssl pkeyutl -decrypt -in test_validate.enc -out test_validate.dec -inkey config/keys/private.pem

if cmp -s test_validate.txt test_validate.dec; then
    echo "   ✅ Key pair validates successfully"
else
    echo "   ❌ Key pair validation failed!"
    rm -f test_validate.*
    exit 1
fi
rm -f test_validate.*

echo ""
echo "6. Creating configuration templates..."
# Create .env.sample for documentation
cat > .env.sample << 'ENV_SAMPLE'
# RSA Key Configuration
# Paths are relative from backend/ directory
RSA_PRIVATE_KEY_PATH=../config/keys/private.pem
RSA_PUBLIC_KEY_PATH=../config/keys/public.pem

# JWT Secrets (for reference - not used with RSA)
JWT_ACCESS_SECRET=your-access-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
ENV_SAMPLE

echo "   ✅ Created .env.sample template"

echo ""
echo "🎉 Initial Key Setup Complete!"
echo ""
echo "📋 What was created:"
echo "   • config/keys/private.pem (600) - Private RSA key"
echo "   • config/keys/public.pem  (644) - Public RSA key"
echo "   • .env.sample             - Configuration template"
echo ""
echo "🚀 Next steps:"
echo "   1. Create backend/.env file with RSA paths"
echo "   2. Run: cd backend && go run main.go"
echo "   3. Verify: 'RSA keys loaded from files' appears in logs"
echo ""
echo "💡 Tip: Keep config/keys/ in .gitignore!"
EOF