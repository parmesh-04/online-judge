#!/bin/bash
# ═══════════════════════════════════════════════════════════
# deploy.sh — Run this script on a fresh EC2 Ubuntu 22.04 instance
# Usage: bash deploy.sh
# ═══════════════════════════════════════════════════════════

set -e  # Exit immediately if any command fails

echo "========================================="
echo "  Online Judge — Deployment Script"
echo "========================================="

# ── Step 1: Update system packages ──
echo "[1/7] Updating system packages..."
sudo apt-get update -qq && sudo apt-get upgrade -y -qq

# ── Step 2: Install Docker (includes Compose V2 as a plugin) ──
# Docker Compose V2 is now built into Docker as 'docker compose' (no hyphen).
# The old 'docker-compose' (V1) is deprecated and not installed by default.
echo "[2/7] Installing Docker + Docker Compose V2..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "✅ Docker installed: $(docker --version)"
  echo "⚠️  NOTE: Log out and back in for the docker group to take effect."
  echo "    Or run: newgrp docker"
else
  echo "✅ Docker already installed: $(docker --version)"
fi

# Verify Docker Compose V2 is available
if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose V2 not found. Installing..."
  DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"
  mkdir -p "$DOCKER_CONFIG/cli-plugins"
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
fi
echo "✅ Docker Compose: $(docker compose version)"

# ── Step 3: Install nginx ──
echo "[3/7] Installing nginx..."
sudo apt-get install -y -qq nginx curl
sudo systemctl enable nginx

# ── Step 4: Set up 2GB swap space ──
# t2.micro has only 1GB RAM. Without swap, Node.js OOM-kills are common.
echo "[4/7] Setting up 2GB swap space..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
  echo "✅ 2GB swap created"
else
  echo "✅ Swap already exists ($(free -h | grep Swap | awk '{print $2}'))"
fi

# ── Step 5: Configure nginx as reverse proxy ──
echo "[5/7] Configuring nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/online-judge
sudo ln -sf /etc/nginx/sites-available/online-judge \
  /etc/nginx/sites-enabled/online-judge
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
echo "✅ nginx configured"

# ── Step 6: Verify .env files are present ──
echo "[6/7] Checking environment files..."
if [ ! -f backend/.env ]; then
  echo "❌ ERROR: backend/.env not found!"
  echo "   Run: cp backend/.env.example backend/.env"
  echo "   Then: nano backend/.env  (fill in real values)"
  exit 1
fi
if [ ! -f compiler/.env ]; then
  echo "❌ ERROR: compiler/.env not found!"
  echo "   Run: cp compiler/.env.example compiler/.env"
  echo "   Then: nano compiler/.env"
  exit 1
fi
if [ ! -f frontend/.env ]; then
  echo "⚠️  WARNING: frontend/.env not found — frontend will use default localhost URLs"
  echo "   Run: cp frontend/.env.example frontend/.env && nano frontend/.env"
fi
echo "✅ Environment files found"

# ── Step 7: Build and start all services ──
echo "[7/7] Starting Docker services..."
docker compose pull mongodb        # pull mongo image first (fast, no build)
docker compose up -d --build       # build all 3 app images and start

# Wait for containers to be healthy
echo "Waiting for services to start (40 seconds)..."
sleep 40

# ── Health check ──
echo "Running health check..."
if curl -sf http://localhost/api/health > /dev/null; then
  echo ""
  echo "========================================="
  echo "  ✅ DEPLOYMENT SUCCESSFUL!"
  echo "  Your app is running at:"
  echo "  http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_EC2_IP')"
  echo ""
  echo "  Seed the database (first time only):"
  echo "  docker compose exec backend node scripts/seed.js"
  echo "========================================="
else
  echo "❌ Health check failed. Checking logs..."
  docker compose logs --tail=40
  exit 1
fi
