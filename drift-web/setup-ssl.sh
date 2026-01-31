#!/bin/bash

# ============================================
# DRIFT SSL Setup Script
# ============================================

DOMAIN=${1:-"34-185-148-16.nip.io"}

echo "🔐 Setting up SSL for: $DOMAIN"

# Create SSL directory
mkdir -p ssl

# Check if we should use Let's Encrypt or self-signed
if command -v certbot &> /dev/null && [[ "$DOMAIN" != *"nip.io"* ]]; then
    echo "📜 Using Let's Encrypt (certbot)..."
    
    # Stop nginx temporarily
    docker compose down 2>/dev/null
    
    # Get certificate
    sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m admin@$DOMAIN
    
    # Copy certs
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/cert.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/key.pem
    sudo chmod 644 ssl/*.pem
    
    echo "✅ Let's Encrypt certificate installed!"
else
    echo "📜 Generating self-signed certificate..."
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Drift/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:34.185.148.16"
    
    echo "⚠️  Self-signed certificate created (browser will show warning)"
fi

echo ""
echo "🚀 Now run: ./deploy.sh"
echo "🌐 Then visit: https://$DOMAIN"
