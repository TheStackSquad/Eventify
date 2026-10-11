# =============================================================================
# Eventify Makefile
# =============================================================================
# Usage:
#   make help           - show all available commands
#   make up             - production: build + start all containers
#   make down           - stop and remove containers
#   make dev            - development: hot reload (Air + Next.js dev)
#   make dev-down       - stop dev containers
#   make build          - build production images without starting
#   make push           - push images to Docker Hub AND GHCR
#   make push-hub       - push to Docker Hub only
#   make push-ghcr      - push to GHCR only
#   make logs           - tail logs from all containers
#   make logs-backend   - tail backend logs only
#   make logs-frontend  - tail frontend logs only
#   make logs-db        - tail postgres logs only
#   make status         - show container status
#   make shell-backend  - open shell in backend container
#   make shell-frontend - open shell in frontend container
#   make shell-db       - open PostgreSQL shell
#   make backup-db      - backup database to backups/
#   make restore-db     - restore database from backups/
#   make reset-db       - drop and recreate DB volume (fresh schema)
#   make clean          - remove all containers, images, volumes
#   make test           - run health checks + Go tests
# =============================================================================

# ---------------------------------------------------------------------------
# Registry config
# All values can be overridden via environment
# ---------------------------------------------------------------------------
DOCKER_HUB_USER  ?= staccsessions
GHCR_USER        ?= ghcr.io/thestacksquad
IMAGE_TAG        ?= latest

BACKEND_IMAGE    := eventify-backend
FRONTEND_IMAGE   := eventify-frontend

FRONTEND_PORT    ?= 3000
BACKEND_PORT     ?= 8081
DB_PORT          ?= 5432
DB_USER          ?= astronautdesh
DB_NAME          ?= Eventify

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help:
	@echo ""
	@echo "Eventify Docker Commands"
	@echo ""
	@echo "Production:"
	@echo "  make up              Start all services (build + run)"
	@echo "  make down            Stop and remove containers"
	@echo "  make restart         Restart all services"
	@echo "  make build           Rebuild images without starting"
	@echo "  make status          Show container status"
	@echo ""
	@echo "Development:"
	@echo "  make dev             Start with hot reload (Air + Next.js)"
	@echo "  make dev-down        Stop development containers"
	@echo ""
	@echo "Registry:"
	@echo "  make push            Push to Docker Hub and GHCR"
	@echo "  make push-hub        Push to Docker Hub only"
	@echo "  make push-ghcr       Push to GHCR only"
	@echo ""
	@echo "Logs:"
	@echo "  make logs            Tail all container logs"
	@echo "  make logs-backend    Tail backend logs only"
	@echo "  make logs-frontend   Tail frontend logs only"
	@echo "  make logs-db         Tail postgres logs only"
	@echo ""
	@echo "Utilities:"
	@echo "  make shell-backend   Open shell in backend container"
	@echo "  make shell-frontend  Open shell in frontend container"
	@echo "  make shell-db        Open PostgreSQL shell"
	@echo "  make backup-db       Backup database to backups/"
	@echo "  make restore-db      Restore database from backups/"
	@echo "  make reset-db        Drop and recreate DB volume"
	@echo "  make clean           Remove all containers, images, volumes"
	@echo "  make test            Run health checks + Go tests"
	@echo ""

# ---------------------------------------------------------------------------
# Production targets
# ---------------------------------------------------------------------------

.PHONY: up
up:
	docker compose up -d --build
	@echo ""
	@echo "Eventify is running"
	@echo "  Frontend  -> http://localhost:$(FRONTEND_PORT)"
	@echo "  Backend   -> http://localhost:$(BACKEND_PORT)"
	@echo "  Postgres  -> localhost:$(DB_PORT)"

.PHONY: down
down:
	docker compose down

.PHONY: restart
restart:
	docker compose restart
	@echo "Services restarted"

.PHONY: build
build:
	docker compose build

.PHONY: status
status:
	docker compose ps

# ---------------------------------------------------------------------------
# Development targets
# ---------------------------------------------------------------------------

.PHONY: dev
dev:
	docker compose -f docker-compose.dev.yml up --build

.PHONY: dev-down
dev-down:
	docker compose -f docker-compose.dev.yml down

# ---------------------------------------------------------------------------
# Push to Docker Hub
# Tags locally built image and pushes to staccsessions/
# ---------------------------------------------------------------------------

.PHONY: push-hub
push-hub:
	docker tag $(BACKEND_IMAGE):$(IMAGE_TAG)  $(DOCKER_HUB_USER)/$(BACKEND_IMAGE):$(IMAGE_TAG)
	docker tag $(FRONTEND_IMAGE):$(IMAGE_TAG) $(DOCKER_HUB_USER)/$(FRONTEND_IMAGE):$(IMAGE_TAG)
	docker push $(DOCKER_HUB_USER)/$(BACKEND_IMAGE):$(IMAGE_TAG)
	docker push $(DOCKER_HUB_USER)/$(FRONTEND_IMAGE):$(IMAGE_TAG)
	@echo "Pushed to Docker Hub -> $(DOCKER_HUB_USER)"

# ---------------------------------------------------------------------------
# Push to GitHub Container Registry (GHCR)
# Tags locally built image and pushes to ghcr.io/thestacksquad/
# ---------------------------------------------------------------------------

.PHONY: push-ghcr
push-ghcr:
	docker tag $(BACKEND_IMAGE):$(IMAGE_TAG)  $(GHCR_USER)/$(BACKEND_IMAGE):$(IMAGE_TAG)
	docker tag $(FRONTEND_IMAGE):$(IMAGE_TAG) $(GHCR_USER)/$(FRONTEND_IMAGE):$(IMAGE_TAG)
	docker push $(GHCR_USER)/$(BACKEND_IMAGE):$(IMAGE_TAG)
	docker push $(GHCR_USER)/$(FRONTEND_IMAGE):$(IMAGE_TAG)
	@echo "Pushed to GHCR -> $(GHCR_USER)"

# ---------------------------------------------------------------------------
# Push to both registries
# ---------------------------------------------------------------------------

.PHONY: push
push: push-hub push-ghcr
	@echo "Images pushed to Docker Hub and GHCR"

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

.PHONY: logs
logs:
	docker compose logs -f

.PHONY: logs-backend
logs-backend:
	docker compose logs -f backend

.PHONY: logs-frontend
logs-frontend:
	docker compose logs -f frontend

.PHONY: logs-db
logs-db:
	docker compose logs -f postgres

# ---------------------------------------------------------------------------
# Shell access
# Note: production backend uses distroless (no shell) — use dev for shell access
# ---------------------------------------------------------------------------

.PHONY: shell-backend
shell-backend:
	docker compose exec backend sh

.PHONY: shell-frontend
shell-frontend:
	docker compose exec frontend sh

.PHONY: shell-db
shell-db:
	docker compose exec postgres psql -U $(DB_USER) -d $(DB_NAME)

# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

.PHONY: backup-db
backup-db:
	@mkdir -p backups
	docker compose exec -T postgres pg_dump -U $(DB_USER) $(DB_NAME) > backups/eventify_backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup saved to backups/"

.PHONY: restore-db
restore-db:
	@read -p "Backup filename (from backups/ folder): " file; \
	docker compose exec -T postgres psql -U $(DB_USER) $(DB_NAME) < backups/$$file
	@echo "Database restored"

.PHONY: reset-db
reset-db:
	@echo "WARNING: This will delete all data in the DB volume."
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ]
	docker compose down -v
	docker compose up -d postgres
	@echo "DB volume reset - schema will re-apply on next boot"

# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------

.PHONY: clean
clean:
	docker compose down --rmi all -v --remove-orphans
	@echo "All containers, images, and volumes removed"

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

.PHONY: test
test:
	@echo "Running health checks..."
	@curl -s http://localhost:$(BACKEND_PORT)/health | grep -q "ok" && echo "Backend OK" || echo "Backend Failed"
	@curl -s http://localhost:$(FRONTEND_PORT) > /dev/null && echo "Frontend OK" || echo "Frontend Failed"
	@echo "Running Go tests..."
	go test -p 1 ./pkg/models/... ./pkg/repository/vendor/... ./pkg/repository/subscription/... ./pkg/services/vendor/...