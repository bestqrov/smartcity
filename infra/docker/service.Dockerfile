# ═══════════════════════════════════════════════════════════
# Generic NestJS Service Dockerfile (multi-stage)
# ═══════════════════════════════════════════════════════════
# Usage:
#   docker build --build-arg SERVICE_NAME=gateway -f infra/docker/service.Dockerfile .
# ═══════════════════════════════════════════════════════════

ARG NODE_VERSION=20

# ── Stage 1: Install dependencies ─────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace root manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy all package.json files to preserve workspace structure
COPY packages/ ./packages/
COPY services/ ./services/

# Install all dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

ARG SERVICE_NAME
RUN test -n "$SERVICE_NAME" || (echo "SERVICE_NAME build arg is required (e.g. --build-arg SERVICE_NAME=finance-service)" >&2 && exit 1)

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy everything from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services ./services
COPY . .

# Generate Prisma client if schema exists
RUN if [ -f packages/database/prisma/schema.prisma ]; then \
      pnpm --filter @smartcity/database exec prisma generate --schema=prisma/schema.prisma; \
    fi

# Build with webpack to produce a single dist/main.js
RUN cd services/${SERVICE_NAME} && ./node_modules/.bin/nest build --webpack

# ── Stage 3: Production ──────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS production

ARG SERVICE_NAME
RUN test -n "$SERVICE_NAME" || (echo "SERVICE_NAME build arg is required (e.g. --build-arg SERVICE_NAME=finance-service)" >&2 && exit 1)

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Add non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy workspace root
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml* ./

# Copy built service
COPY --from=builder /app/services/${SERVICE_NAME}/dist ./services/${SERVICE_NAME}/dist
COPY --from=builder /app/services/${SERVICE_NAME}/package.json ./services/${SERVICE_NAME}/

# Copy built shared packages
COPY --from=builder /app/packages ./packages

# Reuse the builder's node_modules as-is: with pnpm's isolated store, the
# generated Prisma client lives inside node_modules/.pnpm/@prisma+client@*/,
# not at a top-level node_modules/.prisma — a fresh `pnpm install --prod`
# here would recreate the workspace symlinks but never re-run `prisma
# generate` (devDependency, skipped by --prod), leaving a client with no
# generated engine. Copying the already-built tree sidesteps that entirely.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/${SERVICE_NAME}/node_modules ./services/${SERVICE_NAME}/node_modules

USER appuser

ENV NODE_ENV=production

WORKDIR /app/services/${SERVICE_NAME}

CMD ["node", "dist/main.js"]
