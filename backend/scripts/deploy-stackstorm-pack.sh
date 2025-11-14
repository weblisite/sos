#!/bin/bash

# Deploy SynthralOS StackStorm Pack
# This script deploys the StackStorm pack to a running StackStorm instance

set -e

PACK_NAME="synthralos"
PACK_DIR="$(cd "$(dirname "$0")/.." && pwd)/stackstorm-packs/${PACK_NAME}"
ST2_PACKS_DIR="${ST2_PACKS_DIR:-/opt/stackstorm/packs}"

echo "🚀 Deploying StackStorm pack: ${PACK_NAME}"

# Check if StackStorm CLI is available
if ! command -v st2 &> /dev/null; then
    echo "❌ StackStorm CLI (st2) is not installed or not in PATH"
    echo "Please install StackStorm CLI or add it to your PATH"
    exit 1
fi

# Check if pack directory exists
if [ ! -d "$PACK_DIR" ]; then
    echo "❌ Pack directory not found: $PACK_DIR"
    exit 1
fi

# Check if StackStorm is accessible
if ! st2 --version &> /dev/null; then
    echo "❌ Cannot connect to StackStorm. Please check your StackStorm configuration."
    exit 1
fi

echo "📦 Pack directory: $PACK_DIR"

# Option 1: Use st2 pack install (recommended)
if st2 pack install "$PACK_DIR" --force 2>/dev/null; then
    echo "✅ Pack installed successfully using st2 pack install"
else
    echo "⚠️  st2 pack install failed, trying manual copy..."
    
    # Option 2: Manual copy
    if [ -d "$ST2_PACKS_DIR" ]; then
        echo "📋 Copying pack to $ST2_PACKS_DIR"
        sudo cp -r "$PACK_DIR" "$ST2_PACKS_DIR/"
        
        echo "🔄 Reloading pack..."
        st2 pack reload "$PACK_NAME" || true
        
        echo "✅ Pack deployed manually"
    else
        echo "❌ StackStorm packs directory not found: $ST2_PACKS_DIR"
        echo "Please set ST2_PACKS_DIR environment variable or install StackStorm"
        exit 1
    fi
fi

# Verify installation
echo "🔍 Verifying installation..."
if st2 action list --pack="$PACK_NAME" &> /dev/null; then
    echo "✅ Pack verified successfully"
    echo ""
    echo "📋 Available actions:"
    st2 action list --pack="$PACK_NAME"
else
    echo "⚠️  Pack installed but actions not found. This may be normal if actions require additional setup."
fi

echo ""
echo "✨ Deployment complete!"

