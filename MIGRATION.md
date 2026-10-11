# Migration Guide: Individual Containers → Docker Compose

This guide helps you transition from manually running containers to using Docker Compose.

---

## 🎯 Current State

You currently have:
- ✅ `eventify-postgres` - Running on port 5432
- ✅ `eventify-backend-api` - Running on port 8081
- ✅ `eventify-frontend` - Running on port 3000
- ✅ `eventify-network` - Connecting them all
- ✅ `eventify-data` - Volume with your database

**All working!** 🎉

---

## 🔄 Migration Strategy

We'll use Docker Compose to manage these same containers with simpler commands.

**Safe Migration:** We'll keep your existing data volume!

---

## Step 1: Stop Current Containers

```bash
# Stop all running containers
docker stop eventify-frontend eventify-backend-api eventify-postgres

# Verify they're stopped
docker ps
```

**Your data is safe!** The `eventify-data` volume persists.

---

## Step 2: Setup Docker Compose Files

```bash
# Navigate to project root
cd ~/eventify

# Create .env from template (already downloaded)
cp .env.compose .env

# Verify files are in place
ls -la docker-compose.yml .env
```

---

## Step 3: Start with Docker Compose

```bash
# Start everything
docker-compose up -d

# Check status
docker-compose ps
```

**That's it!** Docker Compose is now managing your containers.

---

## 📊 What Changed?

### Before (Manual):
```bash
# Start database
docker start eventify-postgres

# Start backend
docker start eventify-backend-api

# Start frontend
docker start eventify-frontend

# View logs
docker logs -f eventify-backend-api
docker logs -f eventify-frontend
```

### After (Docker Compose):
```bash
# Start everything
docker-compose up -d

# View all logs together
docker-compose logs -f
```

---

## 🔍 Verifying the Migration

```bash
# 1. Check all containers are running
docker-compose ps

# Expected output:
# NAME                    STATUS          PORTS
# eventify-postgres       Up 2 minutes    5432->5432
# eventify-backend-api    Up 2 minutes    8081->8081
# eventify-frontend       Up 2 minutes    3000->3000

# 2. Test backend
curl http://localhost:8081/health

# 3. Test frontend
curl http://localhost:3000

# 4. Test login (verify database still has data)
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"arike@events.com","password":"passWord123"}'
```

---

## 🎁 Benefits You Now Have

### One Command Operations:
```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# View all logs
docker-compose logs -f

# Rebuild everything
docker-compose up -d --build
```

### Service Management:
```bash
# Restart just backend
docker-compose restart backend

# View backend logs only
docker-compose logs -f backend

# Scale services (in production)
docker-compose up -d --scale backend=3
```

### Makefile Shortcuts (if using):
```bash
make start    # Start all services
make stop     # Stop all services
make logs     # View all logs
make status   # Check status
```

---

## 🧹 Cleanup Old Container Names (Optional)

If you want to remove the old stopped containers:

```bash
# Remove old containers (safe - volumes preserved)
docker rm eventify-frontend eventify-backend-api eventify-postgres

# Docker Compose will create new ones with same configuration
```

---

## 🚨 Rollback (If Needed)

If anything goes wrong, rollback to manual mode:

```bash
# Stop compose containers
docker-compose down

# Start your original containers
docker start eventify-postgres
docker start eventify-backend-api  
docker start eventify-frontend
```

**Your data is always safe in the `eventify-data` volume!**

---

## 🎯 Naming Convention Changes

Docker Compose uses project name prefix:

### Old Names:
- `eventify-postgres`
- `eventify-backend-api`
- `eventify-frontend`

### New Names (with Compose):
- `eventify-postgres-1` (or stays as `eventify-postgres` if we set container_name)
- `eventify-backend-api-1`
- `eventify-frontend-1`

**We set `container_name` in docker-compose.yml to keep the same names!**

---

## 📝 Configuration Management

### Before:
```bash
# Backend env vars in .env files
# Frontend env vars in .env.local
# Manual port mapping in docker run commands
```

### After:
```bash
# All configuration in one place: .env
# Docker Compose reads it automatically
# Easy to switch environments (dev/staging/prod)
```

---

## 🎉 Next Steps

Now that you're using Docker Compose:

1. **Investor Demos:**
   - Share repository
   - They run: `docker-compose up -d`
   - Done! 🚀

2. **Team Onboarding:**
   - Clone repo
   - Copy `.env.compose` to `.env`
   - Run `docker-compose up -d`
   - New developer productive in 5 minutes

3. **Deployment:**
   - Same `docker-compose.yml` works on cloud platforms
   - Add production `.env` with real secrets
   - Deploy to AWS ECS, GCP Cloud Run, etc.

---

## 💡 Pro Tips

```bash
# Update just one service
docker-compose up -d --no-deps --build backend

# View resource usage
docker stats

# Execute commands in containers
docker-compose exec backend sh
docker-compose exec postgres psql -U astronautdesh -d Eventify

# Copy files to/from containers
docker-compose cp backend:/app/logs ./logs
```

---

**You're now running a production-ready, orchestrated stack!** 🎊