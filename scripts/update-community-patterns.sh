#!/bin/bash
# Fetch and merge community patterns into local hopeIDS
# Usage: update-community-patterns.sh [PATTERNS_URL]

PATTERNS_URL="${1:-https://exohaven.com/api/hopeids/patterns}"
LOCAL_PATTERNS="${HOME}/.hopeids/community-patterns.json"
VERSION_FILE="${HOME}/.hopeids/community-version"

mkdir -p "$(dirname "$LOCAL_PATTERNS")"

# Get current version
CURRENT_VERSION=""
if [ -f "$VERSION_FILE" ]; then
  CURRENT_VERSION=$(cat "$VERSION_FILE")
fi

# Fetch patterns (with version check)
echo "Checking for pattern updates..."
RESPONSE=$(curl -s "${PATTERNS_URL}?since=${CURRENT_VERSION}")

# Check if up to date
if echo "$RESPONSE" | jq -e '.upToDate' > /dev/null 2>&1; then
  echo "✓ Patterns up to date (v${CURRENT_VERSION})"
  exit 0
fi

# Check for error
if ! echo "$RESPONSE" | jq -e '.ok' > /dev/null 2>&1; then
  echo "✗ Failed to fetch patterns"
  echo "$RESPONSE"
  exit 1
fi

# Extract version and patterns
NEW_VERSION=$(echo "$RESPONSE" | jq -r '.version')
PATTERN_COUNT=$(echo "$RESPONSE" | jq '.count')

# Save patterns
echo "$RESPONSE" | jq '.patterns' > "$LOCAL_PATTERNS"
echo "$NEW_VERSION" > "$VERSION_FILE"

echo "✓ Updated to v${NEW_VERSION} (${PATTERN_COUNT} patterns)"

# Show what's new
if [ -n "$CURRENT_VERSION" ]; then
  echo ""
  echo "New patterns:"
  echo "$RESPONSE" | jq -r '.patterns[-5:] | .[] | "  - \(.category): \(.description // .pattern)"'
fi
