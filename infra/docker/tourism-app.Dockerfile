# ═══════════════════════════════════════════════════════════
# Smart City Tourism Frontend Dockerfile (Next.js)
# ═══════════════════════════════════════════════════════════

ARG NODE_VERSION=20

# ── Stage 1: Dependencies ────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/tourism-app/package.json ./apps/tourism-app/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: Builder ─────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

ARG NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api

ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build workspace packages
RUN pnpm --filter "@smartcity/*" run build 2>/dev/null || true

# Build Next.js app
RUN pnpm --filter tourism-app run build

# ── Stage 3: Production ──────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml* ./
COPY --from=builder /app/apps/tourism-app/.next ./apps/tourism-app/.next
COPY --from=builder /app/apps/tourism-app/public ./apps/tourism-app/public
COPY --from=builder /app/apps/tourism-app/package.json ./apps/tourism-app/
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm store prune

USER appuser

WORKDIR /app/apps/tourism-app

ENV NODE_ENV=production
ENV PORT=3102
ENV HOSTNAME=0.0.0.0

EXPOSE 3102

CMD ["pnpm", "start"]
