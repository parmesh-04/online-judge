# Deployment Guide — Online Judge on AWS EC2

## Prerequisites
- AWS account (free tier eligible)
- GitHub repository with your code
- Gemini API key (free at [ai.google.dev](https://ai.google.dev))
- MongoDB Atlas account (free tier) OR use the Docker MongoDB container

---

## Step 1: Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Configure:
   - **Name:** `online-judge-prod`
   - **AMI:** Ubuntu 22.04 LTS (HVM), SSD Volume Type
   - **Instance type:** `t2.micro` (free tier eligible)
   - **Key pair:** Create new → RSA → `.pem` → download and save safely
   - **Security group** — create new with these inbound rules:
     | Type  | Port | Source |
     |-------|------|--------|
     | SSH   | 22   | My IP only |
     | HTTP  | 80   | Anywhere (0.0.0.0/0) |
     | HTTPS | 443  | Anywhere (0.0.0.0/0) |
   - **Storage:** 20 GiB gp2 (free tier gives 30GB)
3. Click **Launch Instance**

---

## Step 2: Connect to EC2

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## Step 3: Clone and Configure

```bash
git clone https://github.com/YOUR_USERNAME/online-judge.git
cd online-judge

# Copy and configure backend environment
cp backend/.env.example backend/.env
nano backend/.env   # fill in your actual values:
                    # MONGO_URI=mongodb://mongodb:27017/online-judge
                    # JWT_SECRET=<random 64-character string>
                    # GEMINI_API_KEY=<your key from ai.google.dev>

# Copy and configure compiler environment
cp compiler/.env.example compiler/.env
nano compiler/.env  # set MAIN_BACKEND_API_URL=http://backend:5000
```

---

## Step 4: Run Deployment Script

```bash
chmod +x deploy.sh
bash deploy.sh
```

This script will:
1. Update system packages
2. Install Docker and Docker Compose
3. Install and configure nginx
4. Set up 2GB swap space (prevents OOM on t2.micro)
5. Build and start all Docker containers
6. Run a health check

---

## Step 5: Seed the Database

```bash
docker-compose exec backend node scripts/seed.js
```

This creates:
- 10 competitive programming problems (Easy, Medium, Hard)
- Demo users with realistic submission history
- Leaderboard data

---

## Step 6: Verify Deployment

```bash
# Health check
curl http://YOUR_EC2_IP/api/health
# Should return: {"status":"ok","mongoStatus":"connected"}

# Then open in browser:
# http://YOUR_EC2_IP
```

---

## Step 7: Set Up Free HTTPS (Optional but Recommended)

Only works if you have a domain name pointing to your EC2 IP:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
# Certbot auto-renews — you get free SSL forever
```

---

## GitHub Secrets Setup (for CI/CD)

Go to your repo → **Settings → Secrets and variables → Actions**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `EC2_HOST` | Your EC2 public IP address |
| `EC2_SSH_KEY` | Contents of your `.pem` file (the whole thing) |
| `MONGO_URI` | Your MongoDB connection string |
| `JWT_SECRET` | A random 64-character string |
| `GEMINI_API_KEY` | Your Gemini API key |

---

## Useful Commands After Deployment

```bash
# View all running containers
docker-compose ps

# View logs for a specific service
docker-compose logs -f backend
docker-compose logs -f compiler

# Restart a single service
docker-compose restart backend

# Pull latest code and redeploy
git pull origin main && docker-compose up -d --build

# Check resource usage
docker stats

# Re-seed database
docker-compose exec backend node scripts/seed.js --reset

# View nginx access logs
sudo tail -f /var/log/nginx/access.log
```

---

## Architecture on EC2

```
Internet
   │
   ▼
nginx (port 80/443)
   │
   ├──/api/*───────► backend container (port 5000)
   │                     │
   │                     └──► MongoDB container (port 27017)
   │
   ├──/compiler/*──► compiler container (port 8000)
   │                     │
   │                     └──► Docker-in-Docker (sandbox containers)
   │
   └──/*───────────► frontend container (port 3000)
```
