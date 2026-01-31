# Drift Web - GCP Deployment

## Workflow
```
Local: code → git push
GCP:   git pull → ./deploy.sh → live
```

## One-Time GCP Setup

### 1. SSH into your GCP instance
```bash
gcloud compute ssh YOUR_INSTANCE_NAME --zone=YOUR_ZONE
```

### 2. Install Docker
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add user to docker group (logout/login after)
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

### 3. Clone the repo
```bash
cd ~
git clone YOUR_REPO_URL drift
cd drift/drift-web
```

### 4. Create .env file
```bash
cat > .env << 'EOF'
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxx
EOF
```

### 5. Make deploy script executable
```bash
chmod +x deploy.sh
```

### 6. Open firewall port 80
```bash
# In GCP Console or via gcloud:
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags=http-server \
  --description="Allow HTTP"
```

### 7. Deploy!
```bash
./deploy.sh
```

## Daily Workflow

### Local (after changes)
```bash
git add .
git commit -m "feature: xyz"
git push
```

### GCP (to deploy)
```bash
cd ~/drift/drift-web
git pull
./deploy.sh
```

Or one-liner:
```bash
cd ~/drift/drift-web && git pull && ./deploy.sh
```

## Quick Commands

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Rebuild from scratch
docker compose build --no-cache && docker compose up -d

# Check status
docker compose ps
```

## Optional: Auto-deploy with GitHub Webhook

If you want auto-deploy on push, add a webhook listener:

```bash
# Install webhook
sudo apt install webhook -y

# Create hook config
cat > ~/hooks.json << 'EOF'
[
  {
    "id": "deploy-drift",
    "execute-command": "/home/$USER/drift/drift-web/deploy.sh",
    "command-working-directory": "/home/$USER/drift/drift-web"
  }
]
EOF

# Run webhook server
webhook -hooks ~/hooks.json -port 9000 &
```

Then add webhook URL to GitHub: `http://YOUR_GCP_IP:9000/hooks/deploy-drift`
