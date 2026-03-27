#!/usr/bin/env bash
# ===========================================================================
#  Turk — Automated Setup Script
#  Run: chmod +x setup.sh && ./setup.sh
#  Idempotent — safe to run multiple times.
# ===========================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[turk]${NC} $*"; }
ok()    { echo -e "${GREEN}[turk]${NC} $*"; }
warn()  { echo -e "${YELLOW}[turk]${NC} $*"; }
fail()  { echo -e "${RED}[turk]${NC} $*"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Turk — AI Employees Setup          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ──────────────────────────────────────────
# 1. Check prerequisites
# ──────────────────────────────────────────
info "Checking prerequisites..."

MISSING=()

if ! command -v docker &>/dev/null; then
  MISSING+=("docker — install from https://docs.docker.com/get-docker/")
fi

if ! command -v node &>/dev/null; then
  MISSING+=("node — install from https://nodejs.org/ (v18+)")
fi

if ! command -v npm &>/dev/null; then
  MISSING+=("npm — comes with Node.js")
fi

if ! command -v ollama &>/dev/null; then
  MISSING+=("ollama — install from https://ollama.ai/")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  fail "Missing required tools:\n$(printf '  - %s\n' "${MISSING[@]}")"
fi

# Check Docker daemon is running
if ! docker info &>/dev/null 2>&1; then
  fail "Docker daemon is not running. Start Docker Desktop or run 'dockerd'."
fi

ok "All prerequisites found."

# ──────────────────────────────────────────
# 2. Environment file
# ──────────────────────────────────────────
info "Setting up environment..."

if [ ! -f .env ]; then
  cp .env.example .env
  info "Created .env from .env.example"
else
  info ".env already exists, keeping it."
fi

# Generate ENCRYPTION_KEY if it's still the placeholder
if grep -q "your-256-bit-hex-key-here" .env 2>/dev/null; then
  NEW_KEY=$(openssl rand -hex 32)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/your-256-bit-hex-key-here/${NEW_KEY}/" .env
  else
    sed -i "s/your-256-bit-hex-key-here/${NEW_KEY}/" .env
  fi
  ok "Generated ENCRYPTION_KEY."
fi

# For local development, ensure DATABASE_URL points to localhost (not 'db' service)
# The docker-compose 'db' hostname only works inside the docker network.
if grep -q "DATABASE_URL=postgresql://turk:turk@db:" .env 2>/dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|DATABASE_URL=postgresql://turk:turk@db:|DATABASE_URL=postgresql://turk:turk@localhost:|" .env
  else
    sed -i "s|DATABASE_URL=postgresql://turk:turk@db:|DATABASE_URL=postgresql://turk:turk@localhost:|" .env
  fi
  ok "Updated DATABASE_URL to use localhost for local development."
fi

# Ensure WS_URL uses host.docker.internal for local dev
if grep -q "WS_URL=ws://web:" .env 2>/dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|WS_URL=ws://web:|WS_URL=ws://host.docker.internal:|" .env
  else
    sed -i "s|WS_URL=ws://web:|WS_URL=ws://host.docker.internal:|" .env
  fi
  ok "Updated WS_URL for local development."
fi

ok "Environment configured."

# ──────────────────────────────────────────
# 3. Install web dependencies
# ──────────────────────────────────────────
info "Installing web dependencies..."
cd "$PROJECT_DIR/web"

if [ ! -d node_modules ]; then
  npm install
  ok "Web dependencies installed."
else
  info "Web node_modules already exists. Run 'cd web && npm install' to update."
fi

cd "$PROJECT_DIR"

# ──────────────────────────────────────────
# 4. Start PostgreSQL
# ──────────────────────────────────────────
info "Starting PostgreSQL..."

# Check if db container is already running
if docker compose ps --status running 2>/dev/null | grep -q "db"; then
  info "PostgreSQL is already running."
else
  docker compose up db -d
  info "Waiting for PostgreSQL to be ready..."
  # Wait up to 30 seconds for the health check
  for i in $(seq 1 30); do
    if docker compose exec db pg_isready -U turk &>/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  ok "PostgreSQL is ready."
fi

# ──────────────────────────────────────────
# 5. Database migrations
# ──────────────────────────────────────────
info "Pushing database schema..."
cd "$PROJECT_DIR/web"
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push
cd "$PROJECT_DIR"
ok "Database schema is up to date."

# ──────────────────────────────────────────
# 6. Build the OpenClaw agent Docker image
# ──────────────────────────────────────────
info "Building OpenClaw agent Docker image (turk-openclaw)..."
docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent
ok "Agent image built: turk-openclaw"

# ──────────────────────────────────────────
# 7. Ollama model
# ──────────────────────────────────────────
info "Checking Ollama..."

# Check if Ollama is serving
OLLAMA_RUNNING=false
if curl -s http://localhost:11434/api/tags &>/dev/null 2>&1; then
  OLLAMA_RUNNING=true
fi

if [ "$OLLAMA_RUNNING" = true ]; then
  ok "Ollama is running."

  # Check if a tool-calling model is available
  HAS_MODEL=false
  MODELS_JSON=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo '{"models":[]}')

  for model in "llama3.1:8b" "llama3.1" "llama3.3" "qwen2.5" "mistral" "llama3.1:70b"; do
    if echo "$MODELS_JSON" | grep -q "\"$model"; then
      HAS_MODEL=true
      ok "Found tool-calling model: $model"
      break
    fi
  done

  if [ "$HAS_MODEL" = false ]; then
    info "No tool-calling model found. Pulling llama3.1:8b (this may take a while)..."
    ollama pull llama3.1:8b
    ok "Pulled llama3.1:8b"
  fi
else
  warn "Ollama is not running. Start it with: ollama serve"
  warn "Then pull a model: ollama pull llama3.1:8b"
  warn "Note: llama3 does NOT support tool calling. Use llama3.1:8b or newer."
fi

# ──────────────────────────────────────────
# Done!
# ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Setup Complete!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}To start the app:${NC}"
echo ""
echo -e "    1. Make sure Ollama is running:  ${YELLOW}ollama serve${NC}"
echo -e "    2. Start the web server:         ${YELLOW}cd web && node server.js${NC}"
echo -e "    3. Open the dashboard:           ${YELLOW}http://localhost:3124${NC}"
echo ""
echo -e "  ${CYAN}What to do next:${NC}"
echo ""
echo -e "    - Create credentials at ${YELLOW}/credentials${NC} (e.g. test account logins)"
echo -e "    - Create a turk at ${YELLOW}/turks/new${NC} with a target URL and instructions"
echo -e "    - Click ${YELLOW}Start${NC} to launch the AI tester and watch it work"
echo ""
