#!/bin/bash
# Script to start Docker Desktop on macOS

echo "Starting Docker Desktop..."

# Try to start Docker Desktop
if [ -d "/Applications/Docker.app" ]; then
    open -a Docker
    echo "✅ Docker Desktop is starting..."
    echo "⏳ Wait 10-20 seconds for Docker to fully start"
    echo ""
    echo "Check if Docker is running:"
    echo "  docker ps"
    echo ""
    echo "Once Docker is running, you can test the build:"
    echo "  docker build -t sos-platform ."
else
    echo "❌ Docker Desktop not found in /Applications"
    echo ""
    echo "Please install Docker Desktop:"
    echo "  1. Download from: https://www.docker.com/products/docker-desktop"
    echo "  2. Install and start Docker Desktop"
    echo "  3. Then run: docker build -t sos-platform ."
fi

