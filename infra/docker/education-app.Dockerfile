# ═══════════════════════════════════════════════════════════
# Smart City Education Frontend Dockerfile (ArwaEduc — Next.js)
# ═══════════════════════════════════════════════════════════
# Standalone npm project (not part of the pnpm workspace). Runs as a
# normal Next.js server (no static export) so dynamic routes — the
# admin student/parent profile pages and the public /p/[token] magic
# link — work correctly on a direct/cold URL hit.

ARG NODE_VERSION=20

# ── Stage 1: Dependencies ────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

WORKDIR /app

COPY apps/education-apps/frontend/package.json apps/education-apps/frontend/package-lock.json* ./

RUN npm ci

# ── Stage 2: Builder ─────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

ARG NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_FRONTEND_URL=""

ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL}

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/education-apps/frontend ./

RUN npm run build

# ── Stage 3: Production ──────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS production

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY apps/education-apps/frontend/package.json apps/education-apps/frontend/package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY apps/education-apps/frontend/next.config.js ./

USER appuser

ENV NODE_ENV=production
ENV PORT=3011
ENV HOSTNAME=0.0.0.0

EXPOSE 3011

CMD ["npx", "next", "start", "-p", "3011", "-H", "0.0.0.0"]
