#!/bin/bash
# ═══════════════════════════════════════════════════════════
# deploy.sh — Run this script on your EC2 instance to deploy Online Judge
# Usage: bash deploy.sh
# Make executable with: chmod +x deploy.sh
# ═══════════════════════════════════════════════════════════

set -e  # Exit immediately if any command fails

echo "========================================="
echo "  Online Judge — Deployment Script"
echo "========================================="

# Step 1: Update system packages
echo "[1/8] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Step 2: Install Docker if not already installed
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  rm get-docker.sh
  echo "Docker installed. You may need to log out and back in."
else
  echo "Docker already installed: $(docker --version)"
fi

# Step 3: Install Docker Compose if not already installed
echo "[3/8] Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
else
  echo "Docker Compose already installed: $(docker-compose --version)"
fi

# Step 4: Install nginx
echo "[4/8] Installing nginx..."
sudo apt install -y nginx curl

# Step 5: Set up swap space (prevents OOM on t2.micro's 1GB RAM)
echo "[5/8] Setting up 2GB swap space..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "Swap created successfully"
else
  echo "Swap already exists"
fi

# Step 6: Copy nginx config and enable it
echo "[6/8] Configuring nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/online-judge
sudo ln -sf /etc/nginx/sites-available/online-judge \
  /etc/nginx/sites-enabled/online-judge
sudo rm -f /etc/nginx/sites-enabled/default  # remove default site
sudo nginx -t  # test config before reloading
sudo systemctl restart nginx
sudo systemctl enable nginx  # auto-start on reboot

# Step 7: Check .env files exist
echo "[7/8] Checking environment files..."
if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env not found!"
  echo "Copy backend/.env.example to backend/.env and fill in values"
  exit 1
fi
if [ ! -f compiler/.env ]; then
  echo "ERROR: compiler/.env not found!"
  echo "Copy compiler/.env.example to compiler/.env and fill in values"
  exit 1
fi

# Step 8: Pull Docker images and start services
echo "[8/8] Starting Docker services..."
docker-compose pull mongodb  # pull mongo image first
docker-compose up -d --build  # build and start all services

# Wait for services to be healthy
echo "Waiting for services to start (30 seconds)..."
sleep 30

# Health check
echo "Running health check..."
if curl -f http://localhost/api/health > /dev/null 2>&1; then
  echo ""
  echo "========================================="
  echo "  DEPLOYMENT SUCCESSFUL!"
  echo "  Your app is running at:"
  echo "  http://$(curl -s ifconfig.me)"
  echo "========================================="
else
  echo "Health check failed. Checking logs..."
  docker-compose logs --tail=30
  exit 1
fi
