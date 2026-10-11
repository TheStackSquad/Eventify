# 🎉 Eventify - Quick Start Guide

> **For Investors & Demo:** Get Eventify running locally in under 5 minutes.

---

## 📋 Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- 5 minutes of your time ⏱️

**That's it!** No need to install Node.js, Go, PostgreSQL, or any other dependencies.

---

## 🚀 Quick Start (Production Mode)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/eventify.git
cd eventify
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.compose .env

# Edit .env with your values (optional - defaults work for local testing)
# nano .env  # or use any text editor
```

### 3. Start Everything
```bash
docker-compose up -d
```

**That's it!** 🎉

---

## 🌐 Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8081
- **API Health:** http://localhost:8081/health

---

## 📊 View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f postgres
```

---

## 🛑 Stop the Application

```bash
# Stop containers (data persists)
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v
```

---

## 🔄 Restart After Changes

```bash
# Rebuild and restart
docker-compose up -d --build
```

---

## 🧪 Development Mode (Hot Reload)

For active development with automatic code reloading:

```bash
docker-compose -f docker-compose.dev.yml up
```

Changes to code will automatically reload without rebuilding containers.

---

## 📦 What's Running?

When you run `docker-compose up`, you get:

- **PostgreSQL 15** - Database with persistent storage
- **Go Backend** - RESTful API (48 routes, 4 background workers)
- **Next.js Frontend** - Modern React application

All services are connected via a private Docker network.

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Change ports in .env file
FRONTEND_PORT=3001
BACKEND_PORT=8082
```

### Container Won't Start
```bash
# Check container logs
docker-compose logs backend

# Restart specific service
docker-compose restart backend

# Full reset
docker-compose down -v
docker-compose up -d --build
```

### Database Connection Issues
```bash
# Check PostgreSQL is healthy
docker-compose ps

# Access database directly
docker exec -it eventify-postgres psql -U astronautdesh -d Eventify
```

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Browser       │
│  (Port 3000)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Next.js        │
│  Frontend       │
│  Container      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Go Backend     │
│  API Container  │
│  (Port 8081)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  Container      │
│  (Port 5432)    │
└─────────────────┘
```

---

## 📚 Additional Commands

```bash
# View running containers
docker-compose ps

# Execute command in container
docker-compose exec backend sh
docker-compose exec frontend sh

# View resource usage
docker stats

# Clean up everything (including images)
docker-compose down -v --rmi all
docker system prune -a
```

---

## 🎯 For Investors

This containerized setup demonstrates:

- ✅ **Production-ready infrastructure** - Easily deployable to any cloud platform
- ✅ **Scalability** - Each service can scale independently
- ✅ **Developer experience** - New team members productive in 5 minutes
- ✅ **Consistency** - "Works on my machine" problems eliminated
- ✅ **CI/CD ready** - Automated testing and deployment pipelines

---

## 🚢 Deployment Ready

This Docker setup works seamlessly with:

- **AWS ECS / Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**
- **Kubernetes (GKE, EKS, AKS)**
- **Any Docker-compatible hosting**

---

## 💡 Need Help?

- Check logs: `docker-compose logs -f`
- Restart services: `docker-compose restart`
- Fresh start: `docker-compose down -v && docker-compose up -d`

---

**Built with ❤️ for seamless deployment and investor demos**