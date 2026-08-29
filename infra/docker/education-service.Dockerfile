# ═══════════════════════════════════════════════════════════
# Smart City Education Backend Dockerfile (ArwaEduc — Express + Prisma)
# ═══════════════════════════════════════════════════════════
# This app is a standalone npm project (not part of the pnpm workspace),
# with its own package.json/package-lock.json and its own MongoDB
# database, separate from the main smartcity services.

ARG NODE_VERSION=20

# ── Stage 1: Dependencies ────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

WORKDIR /app

COPY apps/education-apps/package.json apps/education-apps/package-lock.json* ./

RUN npm ci

# ── Stage 2: Builder ─────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/education-apps/package.json apps/education-apps/package-lock.json* ./
COPY apps/education-apps/tsconfig.json ./
COPY apps/education-apps/prisma ./prisma
COPY apps/education-apps/src ./src

RUN npx prisma generate
RUN npx tsc

# ── Stage 3: Production ──────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS production

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY apps/education-apps/package.json apps/education-apps/package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY apps/education-apps/prisma ./prisma

USER appuser

ENV NODE_ENV=production
ENV PORT=3010

EXPOSE 3010

CMD ["node", "dist/server.js"]
