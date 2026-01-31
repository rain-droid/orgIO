#!/bin/bash
# Drift Web - GCP Deploy Script
# Run this on your GCP instance after git pull

set -e

echo "🚀 Deploying Drift Web..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Create .env with:"
    echo "  VITE_CLERK_PUBLISHABLE_KEY=pk_..."
    echo "  VITE_SUPABASE_URL=https://..."
    echo "  VITE_SUPABASE_ANON_KEY=eyJ..."
    exit 1
fi

# Load env vars
export $(cat .env | xargs)

# Build and start
echo "📦 Building Docker image..."
docker compose build --no-cache

echo "🔄 Restarting containers..."
docker compose down
docker compose up -d

echo "✅ Drift Web is live!"
echo "   http://$(curl -s ifconfig.me)"
