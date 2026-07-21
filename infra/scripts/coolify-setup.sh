#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════
# Smart City – Coolify Nixpacks Setup Automation Script
# ═══════════════════════════════════════════════════════════
#
# Usage:
#   chmod +x coolify-setup.sh
#   ./coolify-setup.sh \
#     --repo bestqrov/smartcity \
#     --domain smartcity.tondomaine.com \
#     --api-domain api.tondomaine.com \
#     --database-url "mongodb+srv://USER:PASSWORD@cluster.mongodb.net/smartcity?retryWrites=true&w=majority" \
#     --jwt-secret "..." \
#     --jwt-refresh-secret "..."
#
# Requirements:
#   - Coolify installed on your VPS
#   - GitHub App connected to Coolify
#   - mongosh CLI installed (optional, for DB seed)
# ═══════════════════════════════════════════════════════════

REPO="bestqrov/smartcity"
BRANCH="main"
DOMAIN=""
API_DOMAIN=""
DATABASE_URL=""
REDIS_URL=""
JWT_SECRET=""
JWT_REFRESH_SECRET=""
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# ── Parse arguments ──────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo) REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --api-domain) API_DOMAIN="$2"; shift 2 ;;
    --database-url) DATABASE_URL="$2"; shift 2 ;;
    --redis-url) REDIS_URL="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    --jwt-refresh-secret) JWT_REFRESH_SECRET="$2"; shift 2 ;;
    --jwt-access-expiration) JWT_ACCESS_EXPIRATION="$2"; shift 2 ;;
    --jwt-refresh-expiration) JWT_REFRESH_EXPIRATION="$2"; shift 2 ;;
    --help|-h)
      grep "^#" "$0" | sed 's/^# //' | sed 's/^#//' | head -30
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Validate required args ───────────────────────────────
MISSING=""
[[ -z "$DOMAIN" ]] && MISSING="$MISSING --domain"
[[ -z "$API_DOMAIN" ]] && MISSING="$MISSING --api-domain"
[[ -z "$DATABASE_URL" ]] && MISSING="$MISSING --database-url"
[[ -z "$JWT_SECRET" ]] && MISSING="$MISSING --jwt-secret"
[[ -z "$JWT_REFRESH_SECRET" ]] && MISSING="$MISSING --jwt-refresh-secret"

if [[ -n "$MISSING" ]]; then
  echo "❌ Missing required arguments:$MISSING"
  echo "Run: $0 --help"
  exit 1
fi

# ── Coolify CLI check ────────────────────────────────────
if ! command -v coolify &> /dev/null; then
  echo "⚠️  Coolify CLI not found in PATH."
  echo "   Make sure you run this script on the Coolify server."
  echo "   Falling back to manual instructions..."
  CLI_AVAILABLE=false
else
  CLI_AVAILABLE=true
  echo "✅ Coolify CLI detected"
fi

# ── Helper to create Nixpacks resource ───────────────────
create_resource() {
  local NAME=$1
  local BASE_DIR=$2
  local PORT=$3
  local START_CMD=$4

  echo ""
  echo "🚀 Creating resource: $NAME"

  if [[ "$CLI_AVAILABLE" == "true" ]]; then
    # Attempt Coolify CLI creation (best-effort)
    coolify project:create-resource \
      --name "$NAME" \
      --repository "$REPO" \
      --branch "$BRANCH" \
      --base-directory "$BASE_DIR" \
      --build-pack nixpacks \
      --port "$PORT" \
      --start-command "$START_CMD" \
      2>/dev/null || echo "   ⚠️ CLI resource creation failed. Use Coolify UI instead."
  fi

  cat <<EOF > "/tmp/coolify-$NAME-config.txt"
─────────────────────────────────────────
Resource: $NAME
─────────────────────────────────────────
Repository: $REPO
Branch: $BRANCH
Base Directory: $BASE_DIR
Build Pack: Nixpacks
Port: $PORT
Start Command: $START_CMD

Environment Variables (add in Coolify UI):
NODE_ENV=production
PORT=$PORT
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRATION=$JWT_ACCESS_EXPIRATION
JWT_REFRESH_EXPIRATION=$JWT_REFRESH_EXPIRATION
EOF

  echo "   📄 Config written to /tmp/coolify-$NAME-config.txt"
}

# ── 1. Create Redis resource ─────────────────────────────
echo ""
echo "🚀 Creating resource: smartcity-redis"
echo "   (Use Coolify UI → Add New Resource → Redis)"
echo "   Suggested name: smartcity-redis"
cat <<EOF > /tmp/coolify-redis-config.txt
─────────────────────────────────────────
Resource: smartcity-redis
─────────────────────────────────────────
Type: Redis Service (Coolify built-in)
Name: smartcity-redis

After creation, copy the REDIS_URL from Coolify and pass it to this script
with --redis-url, or update the other resources manually.
EOF

# ── 2. Create user-service ───────────────────────────────
create_resource "user-service" "services/user-service" "3001" "node dist/main.js"

# ── 3. Create tourism-service ────────────────────────────
create_resource "tourism-service" "services/tourism-service" "3002" "node dist/main.js"

# ── 4. Create gateway ────────────────────────────────────
echo ""
echo "🚀 Creating resource: gateway"
cat <<EOF > /tmp/coolify-gateway-config.txt
─────────────────────────────────────────
Resource: gateway
─────────────────────────────────────────
Repository: $REPO
Branch: $BRANCH
Base Directory: services/gateway
Build Pack: Nixpacks
Port: 3000
Start Command: node dist/main.js
Domain: https://$API_DOMAIN

Environment Variables:
NODE_ENV=production
PORT=3000
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRATION=$JWT_ACCESS_EXPIRATION
JWT_REFRESH_EXPIRATION=$JWT_REFRESH_EXPIRATION
USER_SERVICE_URL=http://user-service:3001
TOURISM_SERVICE_URL=http://tourism-service:3002
CORS_ORIGINS=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN
EOF
echo "   📄 Config written to /tmp/coolify-gateway-config.txt"

# ── 5. Create tourism-app ────────────────────────────────
echo ""
echo "🚀 Creating resource: tourism-app"
cat <<EOF > /tmp/coolify-tourism-app-config.txt
─────────────────────────────────────────
Resource: tourism-app
─────────────────────────────────────────
Repository: $REPO
Branch: $BRANCH
Base Directory: apps/tourism-app
Build Pack: Nixpacks
Port: 3102
Build Command: npm install && npm run build
Start Command: npm start
Domain: https://$DOMAIN

Environment Variables (must be set BEFORE build):
NODE_ENV=production
PORT=3102
NEXT_PUBLIC_API_URL=https://$API_DOMAIN/api
EOF
echo "   📄 Config written to /tmp/coolify-tourism-app-config.txt"

# ── Summary ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Coolify Setup Configuration Generated"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. If not done, create a Redis service in Coolify named 'smartcity-redis'."
echo ""
echo "2. Create 4 Nixpacks resources in Coolify with these settings:"
echo "   • user-service       → services/user-service       → port 3001"
echo "   • tourism-service    → services/tourism-service    → port 3002"
echo "   • gateway            → services/gateway            → port 3000  → https://$API_DOMAIN"
echo "   • tourism-app        → apps/tourism-app            → port 3102  → https://$DOMAIN"
echo ""
echo "3. Add the environment variables from the generated files:"
echo "   /tmp/coolify-redis-config.txt"
echo "   /tmp/coolify-user-service-config.txt"
echo "   /tmp/coolify-tourism-service-config.txt"
echo "   /tmp/coolify-gateway-config.txt"
echo "   /tmp/coolify-tourism-app-config.txt"
echo ""
echo "4. Deploy in this order:"
echo "   Redis → user-service → tourism-service → gateway → tourism-app"
echo ""
echo "5. Seed the database:"
echo "   cd packages/database"
echo "   DATABASE_URL=\"$DATABASE_URL\" npx prisma db push --accept-data-loss"
echo "   DATABASE_URL=\"$DATABASE_URL\" node prisma/seed-no-tx.js"
echo ""
echo "6. Test the deployment:"
echo "   curl https://$API_DOMAIN/api/health"
echo "   curl https://$API_DOMAIN/api/hotels"
echo "   curl -I https://$DOMAIN"
echo ""
echo "═══════════════════════════════════════════════════════════"
