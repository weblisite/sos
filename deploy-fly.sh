#!/bin/bash
# Deployment script for Fly.io that explicitly uses Docker

echo "🚀 Deploying to Fly.io with explicit Docker configuration..."

# Deploy using Dockerfile explicitly
flyctl deploy -a sos-hs5xqw --dockerfile Dockerfile --no-cache

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Check status: flyctl status -a sos-hs5xqw"
echo "2. View logs: flyctl logs -a sos-hs5xqw"
echo "3. Open app: flyctl open -a sos-hs5xqw"

