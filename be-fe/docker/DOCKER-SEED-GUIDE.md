# Docker Seeding Guide

Step-by-step workflow to start Zonify with Docker Compose.

## Prerequisites

- Docker Desktop installed and running
- Node.js 20+ (only needed for local dev outside Docker)

## Quick Start

Run the steps below in order from the repository root:

### 1. Start PostgreSQL

```bash
docker compose up postgres -d
```

Wait until the healthcheck passes:

```bash
docker compose ps postgres
# Should show "healthy" status
```

### 2. Run Database Migrations

```bash
docker compose exec -T api npx prisma migrate deploy
```

This applies all pending migrations stored in `prisma/migrations/`.

### 3. Seed CSV Data (~400+ entities)

```bash
docker compose exec -T api node prisma/seed.js
```

> **Note:** This step takes 10–30 seconds as it imports data from multiple CSV files (districts, zoning rules, violations, etc.).

### 4. Seed Admin Account

```bash
docker compose exec -T api node prisma/seed-admin-only.js
```

This creates the default admin user:

| Field      | Value            |
|------------|------------------|
| Email      | `admin@test.com` |
| Password   | `password123`    |

### 5. Start API and Web Services

```bash
docker compose up web api -d
```

The application is now accessible at:

- **Frontend:** http://localhost
- **API Health:** http://localhost/api/v1/health (proxied through Nginx)

## Stopping Everything

```bash
docker compose down
```

Data persists in the `zonify_pgdata` volume. To start again, go to step 5.

## Full Reset (Destructive)

```bash
docker compose down -v          # removes all volumes including DB data
docker compose up postgres -d   # restart fresh postgres
# then repeat steps 2–5 above
```

## Troubleshooting

### API won't start — check database connectivity

```bash
docker compose logs api
```

Look for `PrismaClientInitializationError` — this usually means the migration in step 2 hasn't been run yet.

### CORS errors during local dev (non-Docker)

Set the environment variable before starting the API:

```bash
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174 node src/index.js
```

Or leave `ALLOWED_ORIGINS` unset to allow all origins.

### AI service not responding

The default `AI_SERVICE_URL` is `http://host.docker.internal:5000`. If your local AI service runs on a different port, update it in `docker-compose.yml`:

```yaml
environment:
  AI_SERVICE_URL: "http://host.docker.internal:<PORT>"
```
