# CLAUDE.md — Project Guide for Claude Code

## What is Turk?

Turk is an AI-powered autonomous QA testing platform. Each "turk" is an isolated Docker container running an OpenClaw agent with a headless browser, an LLM brain (via local Ollama), and a specific testing role. The web dashboard (Next.js) manages turks, credentials, and streams live results via WebSocket.

## First-Time Setup

Run the automated setup script from the project root:

```bash
chmod +x setup.sh && ./setup.sh
```

This script handles: prerequisite checks, environment config, dependency installation, Docker image builds, database setup, and Ollama model pull. It is idempotent — safe to run multiple times.

**After setup.sh completes, do these two manual steps:**

```bash
# 1. Symlink .env into web/ (Next.js needs it in its own directory)
ln -sf ../.env web/.env

# 2. Fix OLLAMA_BASE_URL for local dev — edit .env and change:
#    OLLAMA_BASE_URL=http://host.docker.internal:11434
#    to:
#    OLLAMA_BASE_URL=http://localhost:11434
```

**Why:** The web server runs on the host machine and needs `localhost` to reach Ollama. `host.docker.internal` is only for containers. The `WS_URL` should stay as `host.docker.internal` because agent containers use it.

## Running the App

```bash
# Start the database (if not already running)
docker compose up db -d

# Start the web server (from web/ directory)
cd web && node server.js
```

The app runs at **http://localhost:3124**.

## Key Commands

| Task | Command |
|---|---|
| Start database | `docker compose up db -d` |
| Start web server | `cd web && node server.js` |
| Build agent image | `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent` |
| Run DB migrations | `cd web && npx prisma db push` |
| Generate Prisma client | `cd web && npx prisma generate` |
| Production build check | `cd web && npx next build` |
| Check Ollama models | `curl -s http://localhost:11434/api/tags` |
| Pull a model | `ollama pull qwen3:14b` |
| Kill process on port 3124 | `lsof -ti:3124 \| xargs kill` |
| Symlink .env for Next.js | `ln -sf ../.env web/.env` |

## Architecture Overview

```
Host Machine
├── Ollama (:11434) — local LLM inference (localhost for web server)
├── Docker
│   ├── PostgreSQL (:5432) — turk_turk-net
│   ├── turk-web (:3124) — Next.js + WebSocket server
│   └── turk-agent-* — one per running turk — turk_turk-net
│       ├── Chromium (headless, CDP on :9222)
│       ├── OpenClaw Gateway (:18789) — connects to Chromium via remote CDP profile
│       ├── Bridge process (OpenClaw ↔ Turk WS, auto-continue loop)
│       └── Custom skills (turk-reporter, qa-testing)
```

### Agent Container Internals

Each agent container runs these processes (started by `entrypoint.sh`):

1. **Chromium (headless)** — Pre-launched with `--no-sandbox --remote-debugging-port=9222`. OpenClaw connects via a remote CDP profile (`browser.profiles.headless.cdpUrl`).
2. **OpenClaw Gateway** — AI agent runtime with ReAct loop, tool calling, persistent memory.
3. **Bridge** (`bridge/index.js`) — Translates OpenClaw CLI JSON output into Turk WebSocket protocol. Has an **auto-continue loop** that keeps testing until the agent sends a summary or is stopped.

### Chat Auto-Update

The turk detail page uses two mechanisms for live updates:
- **WebSocket** — Browser connects to `/api/ws?turkId=X&role=browser` for instant updates.
- **Polling fallback** — Every 3 seconds, fetches `/api/turks/{id}/messages?after=<timestamp>` for any missed messages.

## Project Structure

```
turk/
├── setup.sh                    # Automated setup script (run this first)
├── CLAUDE.md                   # This file
├── docker-compose.yml          # PostgreSQL service
├── .env.example                # Config template
├── .env                        # Local config (gitignored)
│
├── web/                        # Next.js app (UI + API + WebSocket server)
│   ├── .env -> ../.env         # Symlink to root .env (create manually)
│   ├── server.js               # Custom HTTP + WebSocket server (entry point)
│   ├── package.json
│   ├── prisma/schema.prisma    # Database schema
│   └── src/
│       ├── app/                # Pages + API routes
│       │   ├── api/turks/[id]/ # start, stop, pause, resume, findings, messages
│       │   ├── api/ollama/     # models (list), pull (stream pull progress)
│       │   └── turks/new/      # Create turk page (model selector + pull UI)
│       ├── components/         # React components
│       │   ├── turk-chat.tsx   # Live activity stream + findings + WS + polling
│       │   └── turk-controls.tsx # Start/pause/resume/stop buttons + live status
│       └── lib/
│           ├── docker.ts       # Dockerode container orchestration
│           ├── encryption.ts   # AES-256-GCM credential encryption
│           ├── db.ts           # Prisma client singleton
│           └── ollama.ts       # Ollama API client (listModels, pullModel)
│
├── agent/                      # OpenClaw agent container
│   ├── Dockerfile.openclaw     # Container: node:24-slim + Chromium + OpenClaw
│   ├── entrypoint.sh           # Launches Chromium, Gateway, Bridge; generates workspace files
│   ├── bridge/
│   │   └── index.js            # OpenClaw ↔ Turk WS translator with auto-continue + noise filtering
│   └── skills/
│       ├── turk-reporter/SKILL.md   # Bug reporting tool
│       └── qa-testing/SKILL.md      # QA methodology
│
└── shared/                     # Shared TypeScript types
    └── src/
        ├── message-types.ts    # WebSocket protocol types
        └── turk-config.ts      # Turk configuration interfaces
```

## Important Technical Details

### Models
- **Must use tool-calling models.** `llama3` does NOT support tools. Use `qwen3:14b`, `llama3.1:8b`, or newer.
- Models are configured per-turk and routed through Ollama.
- The model name is prefixed with `ollama/` in the OpenClaw config automatically.
- The model selection UI shows only models available in Ollama and offers a "Pull a different model" option.

### Docker Networking
- All containers run on the `turk_turk-net` bridge network (docker compose prefixes project name).
- Agent containers reach Ollama via `host.docker.internal:11434`.
- Agent containers reach the web server via `host.docker.internal:3124` (WS_URL).
- The web server runs on the host and uses `localhost` for Ollama and PostgreSQL.
- `localhost` in target URLs is automatically rewritten to `host.docker.internal` by `docker.ts`.

### Credentials
- Encrypted at rest with AES-256-GCM (ENCRYPTION_KEY in .env).
- Format: `iv:tag:ciphertext` (hex-encoded).
- Decrypted at turk start time and passed to the container as base64-encoded JSON.

### WebSocket Protocol
- Web server runs at `:3124` with WS upgrade on `/api/ws?turkId=X&role=agent|browser`.
- Agent sends `agent_update` messages with kinds: `thought`, `action`, `result`, `screenshot`, `error`, `status`, `bug_report`.
- Browser sends `user_instruction` and `control` (pause/resume/stop) messages.
- All messages are persisted to PostgreSQL.
- The server's upgrade handler passes through non-`/api/ws` connections (required for Next.js HMR in dev mode).

### OpenClaw Integration
- Each agent container runs a full OpenClaw instance with Gateway + CLI.
- Workspace files (SOUL.md, AGENTS.md, USER.md, TOOLS.md) are generated from turk config at container start.
- The bridge spawns `openclaw agent --session-id <id> --message <msg> --json --verbose on` for each turn.
- The bridge auto-continues after each turn (3s delay) until the agent sends a `turk_report` with `type: "summary"`.
- Agent memory persists across runs via named Docker volumes (`turk-memory-<turkId>`).
- Browser config uses a remote CDP profile pointing at pre-launched Chromium (`cdpUrl: http://127.0.0.1:9222`).
- `ssrfPolicy.dangerouslyAllowPrivateNetwork: true` allows testing internal/private URLs.

### Environment Variables

| Variable | Description | Local Dev Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://turk:turk@localhost:5432/turk` |
| `ENCRYPTION_KEY` | 256-bit hex key (required) | Generated by setup.sh |
| `OLLAMA_BASE_URL` | Ollama API (web server uses this) | `http://localhost:11434` |
| `WS_URL` | Agent containers → web server WebSocket | `ws://host.docker.internal:3124/api/ws` |
| `DOCKER_SOCKET` | Docker socket | `/var/run/docker.sock` |

**Key:** `OLLAMA_BASE_URL` must be `localhost` for local dev because the web server runs on the host. Agent containers always use `host.docker.internal` (configured separately in `docker.ts`).

## Manual Setup

If you prefer not to use `setup.sh`:

```bash
# 1. Create .env from template
cp .env.example .env

# 2. Generate encryption key and set it in .env
openssl rand -hex 32
# Edit .env: ENCRYPTION_KEY=<the key you just generated>

# 3. Configure .env for local dev
# Edit .env:
#   DATABASE_URL=postgresql://turk:turk@localhost:5432/turk
#   OLLAMA_BASE_URL=http://localhost:11434
#   WS_URL=ws://host.docker.internal:3124/api/ws

# 4. Symlink .env into web/ (Next.js needs it there)
ln -sf ../.env web/.env

# 5. Install web dependencies
cd web && npm install && cd ..

# 6. Start PostgreSQL
docker compose up db -d

# 7. Push database schema
cd web && npx prisma db push && cd ..

# 8. Build agent Docker image
docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent

# 9. Make sure Ollama is running and pull a tool-calling model
ollama pull qwen3:14b

# 10. Start the web server
cd web && node server.js
```

## Common Issues

- **"ENCRYPTION_KEY environment variable is required"** — Make sure `.env` exists with a valid 64-char hex key AND is symlinked: `ln -sf ../.env web/.env`
- **"Environment variable not found: DATABASE_URL"** — Next.js can't see `.env`. Run: `ln -sf ../.env web/.env`
- **"llama3 does not support tools"** — Use `qwen3:14b`, `llama3.1:8b`, or another tool-calling model.
- **Ollama API calls fail from web server** — Set `OLLAMA_BASE_URL=http://localhost:11434` in `.env` (not `host.docker.internal`).
- **Agent container can't reach Ollama** — Ensure Ollama is running (`ollama serve`). Containers reach it via `host.docker.internal`.
- **Browser tool times out in agent** — Rebuild the agent image to get the latest Chromium/CDP config: `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent`
- **Port 3124 already in use** — `lsof -ti:3124 | xargs kill`
- **Database connection refused** — `docker compose up db -d`
- **Prisma schema out of sync** — `cd web && npx prisma db push`
- **Agent image not found** — `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent`

## Development Workflow

1. **Web code changes** → Restart `cd web && node server.js`
2. **Agent/bridge code changes** → Rebuild image: `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent`, then stop/start the turk from the UI
3. **Prisma schema changes** → `cd web && npx prisma db push`
4. **Verify production build** → `cd web && npx next build`
