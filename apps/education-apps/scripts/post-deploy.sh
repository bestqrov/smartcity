#!/bin/sh
# Production post-deploy for ArwaEduc — run it from the Coolify terminal of the backend container:
#   sh scripts/post-deploy.sh
# 1. Syncs the MongoDB schema (new collections, fields and indexes; never deletes data).
# 2. Runs scripts/post-deploy-check.js: env check, VAPID keys, Evolution, over-limit schools.
# Safe to run several times.
set -e
cd "$(dirname "$0")/.."

echo "== 1/2 Schema (prisma db push) =="
if [ -x node_modules/.bin/prisma ]; then
  PRISMA="node_modules/.bin/prisma"
else
  PRISMA="npx --yes prisma@5.22.0"
fi
# --skip-generate: the client was generated at build time. No --accept-data-loss: prisma stops instead of dropping anything.
$PRISMA db push --skip-generate

echo
echo "== 2/2 Checks =="
node scripts/post-deploy-check.js
