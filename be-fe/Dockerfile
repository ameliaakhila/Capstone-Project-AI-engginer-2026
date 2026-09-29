# ─── Base stage: workspace dependency install ──────────────────────────
FROM node:20-alpine AS base

RUN apk add --no-cache \
    postgresql-dev \
    python3 \
    g++ \
    make

WORKDIR /app

# Copy root manifest + both workspace manifests so npm ci can resolve all
# workspace member dependencies (including web devDeps like vite)
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --include=dev

# ─── Web build stage ──────────────────────────────────────────────────
FROM base AS web-stage

# Accept VITE_ build args — passed from docker-compose build.args
# These are baked into the JS bundle by Vite at build time
ARG VITE_API_URL=""
ARG VITE_API_BASE_URL="/api/v1"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY apps/web/ ./apps/web/
RUN cd apps/web && npm run build

# ─── API build stage ──────────────────────────────────────────────────
FROM base AS api-stage

COPY apps/api/ ./apps/api/
COPY apps/api/prisma/schema.prisma ./prisma/schema.prisma
COPY apps/api/prisma/migrations/ ./prisma/migrations/
RUN cd apps/api && npx prisma generate

# ─── Web final: Nginx serving static SPA ──────────────────────────────
FROM nginx:alpine AS web-final

COPY --from=web-stage /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ─── API final: Node.js runtime with built app ────────────────────────
FROM node:20-alpine AS api-final

RUN apk add --no-cache \
    postgresql-dev \
    python3 \
    g++ \
    make

WORKDIR /app

# Copy workspace deps from base (workspace resolution)
# All workspace member package.json files are required for npm to correctly
# resolve and install workspace dependencies (including dotenv for apps/api).
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --omit=dev

# Copy built API source + prisma schema
COPY --from=api-stage /app/apps/api/ ./apps/api/
COPY --from=api-stage /app/prisma/ ./prisma/

# Copy the generated Prisma client (produced by `prisma generate` in api-stage)
# Without this, @prisma/client throws "did not initialize yet" at runtime.
COPY --from=api-stage /app/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=api-stage /app/node_modules/@prisma/client/ ./node_modules/@prisma/client/

WORKDIR /app/apps/api

EXPOSE 3001
CMD ["node", "src/index.js"]
