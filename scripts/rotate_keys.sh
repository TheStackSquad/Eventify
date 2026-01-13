cat > scripts/rotate_keys.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 RSA Key Rotation Script"
echo "=========================="
echo "WARNING: This will invalidate ALL existing JWT tokens!"
echo "Users will need to re-authenticate after rotation."
echo ""

read -p "Continue with key rotation? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rotation cancelled"
    exit 1
fi

echo ""
echo "1. Creating backup of current keys..."
BACKUP_DIR="config/keys/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "config/keys/private.pem" ]; then
    cp config/keys/private.pem "$BACKUP_DIR/"
    echo "   ✅ Private key backed up to: $BACKUP_DIR/private.pem"
fi

if [ -f "config/keys/public.pem" ]; then
    cp config/keys/public.pem "$BACKUP_DIR/"
    echo "   ✅ Public key backed up to: $BACKUP_DIR/public.pem"
fi

echo ""
echo "2. Generating new 2048-bit RSA key pair..."
openssl genpkey -algorithm RSA -out config/keys/private.pem.new -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in config/keys/private.pem.new -out config/keys/public.pem.new

echo ""
echo "3. Validating new key pair..."
# Test that keys work together
echo "test data" > test.txt
openssl pkeyutl -encrypt -in test.txt -out test.enc -pubin -inkey config/keys/public.pem.new
openssl pkeyutl -decrypt -in test.enc -out test.dec -inkey config/keys/private.pem.new

if diff test.txt test.dec > /dev/null; then
    echo "   ✅ New key pair validates successfully"
else
    echo "   ❌ New key pair validation failed!"
    rm -f test.txt test.enc test.dec
    exit 1
fi
rm -f test.txt test.enc test.dec

echo ""
echo "4. Deploying new keys (atomic swap)..."
mv config/keys/private.pem.new config/keys/private.pem
mv config/keys/public.pem.new config/keys/public.pem

# Set secure permissions
chmod 600 config/keys/private.pem
chmod 644 config/keys/public.pem

echo "   ✅ New keys deployed with secure permissions"

echo ""
echo "5. Verifying server can load new keys..."
cd backend
if go run main.go 2>&1 | grep -q "RSA keys loaded from files"; then
    echo "   ✅ Server can load new keys successfully"
else
    echo "   ⚠️  Server had issues loading new keys"
    echo "   Check logs above for details"
fi
cd ..

echo ""
echo "🎉 Key Rotation Complete!"
echo ""
echo "📋 Summary:"
echo "   • Old keys backed up to: $BACKUP_DIR/"
echo "   • New keys deployed to: config/keys/"
echo "   • All existing JWT tokens are now INVALID"
echo "   • Users must log in again to get new tokens"
echo ""
echo "⚠️  Next steps:"
echo "   1. Restart all running server instances"
echo "   2. Monitor authentication logs"
echo "   3. Inform users if necessary"
EOF