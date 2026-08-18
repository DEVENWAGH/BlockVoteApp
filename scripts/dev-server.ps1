# Start BlockVote Next.js backend (Hardhat + API on :3000)
# Uses MongoDB already running locally (MongoDB Compass / mongod) — no Docker.
# Always activates the DEVELOPMENT env profile (local DB + Hardhat).
# Usage: .\scripts\dev-server.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Voting = Join-Path $Root "Voting"

Write-Host "==> BlockVote backend (DEVELOPMENT profile)" -ForegroundColor Cyan
Write-Host "    Expect MongoDB via Compass/mongod on :27017" -ForegroundColor DarkGray
Write-Host "    DB name: blockvote_local | Hardhat :8545 | Next.js :3000" -ForegroundColor DarkGray

# Quick check that something is listening on 27017
try {
    $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -WarningAction SilentlyContinue
    if (-not $tcp.TcpTestSucceeded) {
        Write-Host ""
        Write-Host "WARNING: Nothing listening on 127.0.0.1:27017" -ForegroundColor Yellow
        Write-Host "  Start MongoDB locally, then open Compass and connect to:" -ForegroundColor Yellow
        Write-Host "  mongodb://127.0.0.1:27017/blockvote_local" -ForegroundColor DarkGray
        Write-Host ""
    } else {
        Write-Host "==> MongoDB reachable on :27017 (Compass/local)" -ForegroundColor Green
    }
} catch {
    Write-Host "==> Skipping MongoDB port check" -ForegroundColor DarkGray
}

Push-Location $Voting
try {
    if (-not (Test-Path (Join-Path $Voting "node_modules"))) {
        Write-Host "==> Installing npm deps (first run)..." -ForegroundColor Yellow
        yarn install
    }

    if (-not (Test-Path (Join-Path $Voting ".env.development"))) {
        Write-Host "==> Bootstrapping isolated env profiles (yarn env:init)..." -ForegroundColor Yellow
        yarn env:init
    }

    Write-Host "==> Starting yarn dev (Hardhat + contract deploy + Next.js)..." -ForegroundColor Green
    yarn dev
}
finally {
    Pop-Location
}
