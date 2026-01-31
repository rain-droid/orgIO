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

# Load env vars properly (handles special chars)
set -a
source .env
set +a

# Debug: show loaded vars
echo "📋 Loaded env vars:"
echo "   CLERK: ${VITE_CLERK_PUBLISHABLE_KEY:0:20}..."
echo "   SUPABASE URL: ${VITE_SUPABASE_URL}"
echo "   SUPABASE KEY: ${VITE_SUPABASE_ANON_KEY:0:20}..."

# Build and start
echo "📦 Building Docker image..."
docker compose build --no-cache

echo "🔄 Restarting containers..."
docker compose down
docker compose up -d

IP=$(curl -s ifconfig.me)
echo "✅ Drift Web is live!"

if [ -f ssl/cert.pem ]; then
    echo "   🔒 https://$IP"
    echo "   🔒 https://$(echo $IP | tr '.' '-').nip.io"
else
    echo "   http://$IP"
    echo ""
    echo "💡 To enable HTTPS, run: chmod +x setup-ssl.sh && ./setup-ssl.sh"
fi
