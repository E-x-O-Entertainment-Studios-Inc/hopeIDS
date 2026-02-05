#!/bin/bash
# Auto-update hopeIDS patterns

set -e

echo "🔄 Checking for hopeIDS pattern updates..."

# Get current version
CURRENT_VERSION=$(npm list -g hopeid --depth=0 2>/dev/null | grep hopeid@ | sed 's/.*@//' || echo "unknown")
echo "   Current version: $CURRENT_VERSION"

# Check for updates
LATEST_VERSION=$(npm view hopeid version 2>/dev/null || echo "unknown")
echo "   Latest version: $LATEST_VERSION"

if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "unknown" ]; then
    echo "   📦 Updating hopeIDS to v$LATEST_VERSION..."
    npm install -g hopeid@latest --silent
    echo "   ✅ Updated successfully!"
else
    echo "   ✅ Already up to date"
fi

# If hopeIDS has a pattern update mechanism, we can use it here
# For now, reinstalling the package ensures we have the latest patterns

echo ""
