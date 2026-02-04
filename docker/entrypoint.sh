#!/bin/bash
set -e

echo "🛡️ hopeIDS Test Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if API key is provided
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set"
    echo "   Set it with: docker run -e ANTHROPIC_API_KEY=sk-... "
fi

# Show hopeIDS stats
echo ""
echo "📊 hopeIDS Status:"
hopeid stats

echo ""
echo "🚀 Starting OpenClaw Gateway..."
echo "   Webchat: http://localhost:3333"
echo ""

# Start the gateway
exec "$@"
