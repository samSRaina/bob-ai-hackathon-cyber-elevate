#!/bin/bash
set -e

echo "======================================"
echo "    🚀 Starting Bob Engine...   "
echo "======================================"

echo ""
echo "[1/6] Starting PostgreSQL database..."
docker compose up -d db
echo "Waiting for database to be ready..."
sleep 5 # give it a moment

echo ""
echo "[2/6] Installing root dependencies..."
bun install

echo ""
echo "[3/6] Configuring environment & backend dependencies..."
cd src
if [ ! -f .env ]; then
  echo "creating .env from .env.example..."
  cp .env.example .env
fi
uv sync
cd ..

echo ""
echo "[4/6] Installing frontend dependencies..."
cd src/web
bun install
cd ../..

echo ""
echo "[5/6] Seeding the database..."
cd src
uv run python -m app.seed
cd ..

echo ""
echo "[6/6] Starting both backend and frontend servers..."
bun run dev
