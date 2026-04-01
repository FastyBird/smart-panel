#
# FastyBird Smart Panel - Production Docker Image
#
# Includes backend (NestJS) + admin UI (Vue.js static files)
# served together as a single container.
#
# Build:
#   docker build -t fastybird/smart-panel -f docker/prod/Dockerfile .
#
# Run:
#   docker run -d -p 3000:3000 -v smart-panel-data:/data fastybird/smart-panel
#

# ============================================================
# Stage 1: Build admin UI static files
# ============================================================
FROM node:24-alpine AS admin-builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /build

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .env ./

# Copy only packages needed for admin build
COPY apps/backend/package.json apps/backend/
COPY apps/admin/package.json apps/admin/
COPY packages/extension-sdk/package.json packages/extension-sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/backend/ apps/backend/
COPY apps/admin/ apps/admin/
COPY packages/extension-sdk/ packages/extension-sdk/
COPY spec/ spec/
COPY var/ var/

# Generate specs and build (extension SDK must be built before openapi generation)
RUN pnpm run generate:spec && \
	pnpm --filter @fastybird/smart-panel-extension-sdk build && \
	pnpm run generate:openapi && \
	pnpm --filter @fastybird/smart-panel-admin build:no-check

# ============================================================
# Stage 2: Build backend
# ============================================================
FROM node:24-alpine AS backend-builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /build

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .env ./

# Copy only packages needed for backend build
COPY apps/backend/package.json apps/backend/
COPY packages/extension-sdk/package.json packages/extension-sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/backend/ apps/backend/
COPY packages/extension-sdk/ packages/extension-sdk/
COPY spec/ spec/
COPY var/ var/

# Generate specs and build (extension SDK must be built before openapi generation)
RUN pnpm run generate:spec && \
	pnpm --filter @fastybird/smart-panel-extension-sdk build && \
	pnpm run generate:openapi && \
	pnpm --filter @fastybird/smart-panel-backend build

# Create a standalone deployment with flat node_modules (no pnpm symlinks).
# pnpm deploy resolves all workspace dependencies into a self-contained directory.
RUN pnpm --filter @fastybird/smart-panel-backend deploy --prod /build/deploy

# ============================================================
# Stage 3: Production runtime
# ============================================================
FROM node:24-alpine AS runtime

RUN apk add --no-cache tini

WORKDIR /app

# Copy the standalone deployment (flat node_modules, no pnpm symlinks)
COPY --from=backend-builder /build/deploy/node_modules/ ./node_modules/
COPY --from=backend-builder /build/deploy/dist/ ./dist/
COPY --from=backend-builder /build/deploy/package.json ./

# Copy admin static files into backend's static directory
COPY --from=admin-builder /build/apps/admin/dist/ ./static/

# Copy seed/config data
COPY var/ /app/var/

# Copy entrypoint script (handles both standalone and HA add-on modes)
COPY docker/prod/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create data directories
RUN mkdir -p /data/db /data/config

# Environment defaults
ENV NODE_ENV=production \
	FB_BACKEND_PORT=3000 \
	FB_ADMIN_UI_PATH=/app/static \
	FB_DB_PATH=/data/db \
	FB_CONFIG_PATH=/data/config \
	FB_DB_SYNC=false \
	FB_DB_MIGRATIONS_RUN=true

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
	CMD wget -qO- http://localhost:${FB_BACKEND_PORT}/api/system/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start via entrypoint wrapper (reads HA options.json if present, then starts node)
CMD ["/app/entrypoint.sh"]
