#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Smart City Ecosystem – Setup Script (Linux / macOS)
# ═══════════════════════════════════════════════════════════
# Usage:  bash infra/scripts/setup.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Colour

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Smart City Ecosystem – Setup${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ── 1. Check Node.js version ─────────────────────────────
echo -e "${YELLOW}[1/8] Checking Node.js version...${NC}"
if ! command -v node &>/dev/null; then
  echo -e "${RED}  ERROR: Node.js is not installed. Please install Node.js >= 20.${NC}"
  exit 1
fi
NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "${RED}  ERROR: Node.js >= 20 is required (found $NODE_VERSION)${NC}"
  exit 1
fi
echo -e "${GREEN}  Node.js $NODE_VERSION${NC}"

# ── 2. Check pnpm ────────────────────────────────────────
echo -e "${YELLOW}[2/8] Checking pnpm...${NC}"
if ! command -v pnpm &>/dev/null; then
  echo -e "${RED}  ERROR: pnpm is not installed. Run: npm install -g pnpm${NC}"
  exit 1
fi
PNPM_VERSION=$(pnpm --version)
echo -e "${GREEN}  pnpm v$PNPM_VERSION${NC}"

# ── 3. Copy .env.example to .env ─────────────────────────
echo -e "${YELLOW}[3/8] Setting up environment variables...${NC}"
if [ ! -f "$REPO_ROOT/.env" ]; then
  if [ -f "$REPO_ROOT/.env.example" ]; then
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    echo -e "${GREEN}  Created .env from .env.example${NC}"
  else
    echo -e "${YELLOW}  WARNING: .env.example not found – skipping${NC}"
  fi
else
  echo -e "${GREEN}  .env already exists – skipping${NC}"
fi

# ── 4. Install dependencies ──────────────────────────────
echo -e "${YELLOW}[4/8] Installing dependencies...${NC}"
cd "$REPO_ROOT"
pnpm install
echo -e "${GREEN}  Dependencies installed${NC}"

# ── 5. Start infrastructure (MongoDB + Redis) ────────────
echo -e "${YELLOW}[5/8] Starting MongoDB & Redis via Docker...${NC}"
cd "$REPO_ROOT"
if command -v docker-compose &>/dev/null; then
  docker-compose up -d mongodb redis || {
    echo -e "${YELLOW}  WARNING: Docker Compose failed – make sure Docker is running${NC}"
  }
elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  docker compose up -d mongodb redis || {
    echo -e "${YELLOW}  WARNING: Docker Compose failed – make sure Docker is running${NC}"
  }
else
  echo -e "${YELLOW}  WARNING: Docker / Docker Compose not found – skipping${NC}"
fi

# Wait for services to be healthy
echo -e "${GRAY}  Waiting for services to be ready...${NC}"
sleep 5

# ── 6. Prisma generate ───────────────────────────────────
echo -e "${YELLOW}[6/8] Generating Prisma client...${NC}"
cd "$REPO_ROOT"
pnpm db:generate || {
  echo -e "${YELLOW}  WARNING: Prisma generate failed – check packages/database/prisma/schema.prisma${NC}"
}
echo -e "${GREEN}  Prisma client generated${NC}"

# ── 7. Prisma db push ────────────────────────────────────
echo -e "${YELLOW}[7/8] Pushing database schema...${NC}"
cd "$REPO_ROOT"
pnpm db:push || {
  echo -e "${YELLOW}  WARNING: Prisma db push failed – is MongoDB running?${NC}"
}
echo -e "${GREEN}  Database schema pushed${NC}"

# ── 8. Prisma db seed ────────────────────────────────────
echo -e "${YELLOW}[8/8] Seeding database...${NC}"
cd "$REPO_ROOT"
pnpm db:seed || {
  echo -e "${YELLOW}  WARNING: Prisma db seed failed${NC}"
}
echo -e "${GREEN}  Database seeded${NC}"

# ── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}  Infrastructure:${NC}"
echo "    MongoDB:  localhost:27017"
echo "    Redis:    localhost:6379"
echo ""
echo -e "${CYAN}  Backend services:${NC}"
echo "    Gateway:           localhost:3000"
echo "    User Service:      localhost:3001"
echo "    Tourism Service:   localhost:3002"
echo "    Health Service:    localhost:3003"
echo "    Education Service: localhost:3004"
echo "    Services Service:  localhost:3005"
echo "    Billing Service:   localhost:3006"
echo "    Notification:      localhost:3007"
echo ""
echo -e "${CYAN}  Frontend apps:${NC}"
echo "    Auth Portal:       localhost:3100"
echo "    Admin Dashboard:   localhost:3101"
echo "    Tourism App:       localhost:3102"
echo "    Health App:        localhost:3103"
echo "    Education App:     localhost:3104"
echo "    Services App:      localhost:3105"
echo ""
echo -e "${CYAN}  Quick start:${NC}"
echo "    pnpm dev           – Start everything"
echo "    pnpm dev:tourism   – Start tourism stack"
echo "    pnpm dev:auth      – Start auth stack"
echo ""
