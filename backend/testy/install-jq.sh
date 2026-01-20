#!/bin/bash
# install-jq.sh - Install jq on Windows/MINGW64

echo "=== jq Installation Helper for Windows ==="
echo ""

# Check if jq is already installed
if command -v jq &> /dev/null; then
    echo "✓ jq is already installed!"
    jq --version
    exit 0
fi

echo "jq is not installed. Attempting to install..."
echo ""

# Method 1: Try pacman (Git Bash/MINGW64)
if command -v pacman &> /dev/null; then
    echo "Method 1: Using pacman..."
    echo "Running: pacman -S mingw-w64-x86_64-jq"
    echo ""
    pacman -S mingw-w64-x86_64-jq
    
    if command -v jq &> /dev/null; then
        echo ""
        echo "✓ jq installed successfully!"
        jq --version
        exit 0
    fi
fi

# Method 2: Download binary
echo ""
echo "Method 2: Downloading jq binary..."
echo ""

JQ_VERSION="1.7.1"
JQ_URL="https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-windows-amd64.exe"
JQ_INSTALL_DIR="/usr/bin"

echo "Downloading from: $JQ_URL"
echo "Installing to: $JQ_INSTALL_DIR/jq.exe"
echo ""

if command -v curl &> /dev/null; then
    curl -L "$JQ_URL" -o "$JQ_INSTALL_DIR/jq.exe" 2>&1
    
    if [ -f "$JQ_INSTALL_DIR/jq.exe" ]; then
        chmod +x "$JQ_INSTALL_DIR/jq.exe"
        echo ""
        echo "✓ jq installed successfully!"
        jq --version
        exit 0
    fi
else
    echo "✗ curl not available. Cannot download jq."
fi

# Method 3: Manual instructions
echo ""
echo "=== MANUAL INSTALLATION REQUIRED ==="
echo ""
echo "Please install jq manually:"
echo ""
echo "Option A - Using pacman (recommended):"
echo "  pacman -S mingw-w64-x86_64-jq"
echo ""
echo "Option B - Download binary:"
echo "  1. Download: https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-windows-amd64.exe"
echo "  2. Rename to: jq.exe"
echo "  3. Move to: C:\\Program Files\\Git\\usr\\bin\\"
echo "  4. Restart Git Bash"
echo ""
echo "Option C - Using Chocolatey:"
echo "  choco install jq"
echo ""
echo "Option D - Using Scoop:"
echo "  scoop install jq"
echo ""

exit 1