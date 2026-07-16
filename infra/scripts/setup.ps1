# ═══════════════════════════════════════════════════════════
# Smart City Ecosystem – Setup Script (PowerShell / Windows)
# ═══════════════════════════════════════════════════════════
# Usage:  .\infra\scripts\setup.ps1
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Smart City Ecosystem – Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check Node.js version ─────────────────────────────
Write-Host "[1/8] Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = (node --version 2>$null)
    if (-not $nodeVersion) { throw "not found" }
    $major = [int]($nodeVersion -replace '^v', '' -split '\.')[0]
    if ($major -lt 20) {
        Write-Host "  ERROR: Node.js >= 20 is required (found $nodeVersion)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js is not installed. Please install Node.js >= 20." -ForegroundColor Red
    exit 1
}

# ── 2. Check pnpm ────────────────────────────────────────
Write-Host "[2/8] Checking pnpm..." -ForegroundColor Yellow
try {
    $pnpmVersion = (pnpm --version 2>$null)
    if (-not $pnpmVersion) { throw "not found" }
    Write-Host "  pnpm v$pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: pnpm is not installed. Run: npm install -g pnpm" -ForegroundColor Red
    exit 1
}

# ── 3. Copy .env.example to .env ─────────────────────────
Write-Host "[3/8] Setting up environment variables..." -ForegroundColor Yellow
$envFile = Join-Path $PSScriptRoot "..\..\..\.env"
$envExample = Join-Path $PSScriptRoot "..\..\..\.env.example"
# Resolve relative to repo root
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $repoRoot ".env"
$envExample = Join-Path $repoRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "  Created .env from .env.example" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: .env.example not found – skipping" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  .env already exists – skipping" -ForegroundColor Green
}

# ── 4. Install dependencies ──────────────────────────────
Write-Host "[4/8] Installing dependencies..." -ForegroundColor Yellow
Push-Location $repoRoot
try {
    pnpm install
    Write-Host "  Dependencies installed" -ForegroundColor Green
} finally {
    Pop-Location
}

# ── 5. Start infrastructure (MongoDB + Redis) ────────────
Write-Host "[5/8] Starting MongoDB & Redis via Docker..." -ForegroundColor Yellow
try {
    Push-Location $repoRoot
    docker-compose up -d mongodb redis
    Write-Host "  MongoDB & Redis started" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Docker Compose failed – make sure Docker Desktop is running" -ForegroundColor DarkYellow
} finally {
    Pop-Location
}

# Wait for services to be healthy
Write-Host "  Waiting for services to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# ── 6. Prisma generate ───────────────────────────────────
Write-Host "[6/8] Generating Prisma client..." -ForegroundColor Yellow
Push-Location $repoRoot
try {
    pnpm db:generate
    Write-Host "  Prisma client generated" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Prisma generate failed – check packages/database/prisma/schema.prisma" -ForegroundColor DarkYellow
} finally {
    Pop-Location
}

# ── 7. Prisma db push ────────────────────────────────────
Write-Host "[7/8] Pushing database schema..." -ForegroundColor Yellow
Push-Location $repoRoot
try {
    pnpm db:push
    Write-Host "  Database schema pushed" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Prisma db push failed – is MongoDB running?" -ForegroundColor DarkYellow
} finally {
    Pop-Location
}

# ── 8. Prisma db seed ────────────────────────────────────
Write-Host "[8/8] Seeding database..." -ForegroundColor Yellow
Push-Location $repoRoot
try {
    pnpm db:seed
    Write-Host "  Database seeded" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Prisma db seed failed" -ForegroundColor DarkYellow
} finally {
    Pop-Location
}

# ── Done ──────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Infrastructure:" -ForegroundColor Cyan
Write-Host "    MongoDB:  localhost:27017"
Write-Host "    Redis:    localhost:6379"
Write-Host ""
Write-Host "  Backend services:" -ForegroundColor Cyan
Write-Host "    Gateway:          localhost:3000"
Write-Host "    User Service:     localhost:3001"
Write-Host "    Tourism Service:  localhost:3002"
Write-Host "    Health Service:   localhost:3003"
Write-Host "    Education Service:localhost:3004"
Write-Host "    Services Service: localhost:3005"
Write-Host "    Billing Service:  localhost:3006"
Write-Host "    Notification:     localhost:3007"
Write-Host ""
Write-Host "  Frontend apps:" -ForegroundColor Cyan
Write-Host "    Auth Portal:      localhost:3100"
Write-Host "    Admin Dashboard:  localhost:3101"
Write-Host "    Tourism App:      localhost:3102"
Write-Host "    Health App:       localhost:3103"
Write-Host "    Education App:    localhost:3104"
Write-Host "    Services App:     localhost:3105"
Write-Host ""
Write-Host "  Quick start:" -ForegroundColor Cyan
Write-Host "    pnpm dev           – Start everything"
Write-Host "    pnpm dev:tourism   – Start tourism stack"
Write-Host "    pnpm dev:auth      – Start auth stack"
Write-Host ""
