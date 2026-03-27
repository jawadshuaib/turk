# CLAUDE.md — Project Guide for Claude Code

## What is Turk?

Turk is an AI-powered autonomous QA testing platform. Each "turk" is an isolated Docker container running an OpenClaw agent with a browser, an LLM brain (via local Ollama), and a specific testing role. The web dashboard (Next.js) manages turks, credentials, and streams live results via WebSocket.

## First-Time Setup

Run the automated setup script from the project root:

```bash
chmod +x setup.sh && ./setup.sh
```

This script handles everything: prerequisite checks, environment config, dependency installation, Docker image builds, database setup, and Ollama model pull. It is idempotent — safe to run multiple times.

If you need to do it manually, see the "Manual Setup" section below.

## Running the App

```bash
# Start the database (if not already running)
docker compose up db -d

# Start the web server (from project root)
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
| Pull a model | `ollama pull llama3.1:8b` |

## Architecture Overview

```
Host Machine
├── Ollama (:11434) — local LLM inference
├── Docker
│   ├── PostgreSQL (:5432) — turk-net
│   ├── turk-web (:3124) — Next.js + WebSocket server — turk-net
│   └── turk-agent-* — one per running turk — turk-net
│       ├── OpenClaw Gateway (:18789)
│       ├── Bridge process (OpenClaw ↔ Turk WS)
│       └── Chromium (headless)
```

## Project Structure

```
turk/
├── setup.sh                    # Automated setup script (run this first)
├── CLAUDE.md                   # This file
├── docker-compose.yml          # PostgreSQL + web services
├── .env.example                # Config template
│
├── web/                        # Next.js app (UI + API + WebSocket server)
│   ├── server.js               # Custom HTTP + WebSocket server (entry point)
│   ├── package.json
│   ├── prisma/schema.prisma    # Database schema
│   └── src/
│       ├── app/                # Pages + API routes
│       │   └── api/turks/[id]/ # start, stop, pause, resume, findings, messages, logs
│       ├── components/         # React components (turk-chat, turk-controls, etc.)
│       └── lib/
│           ├── docker.ts       # Dockerode container orchestration
│           ├── encryption.ts   # AES-256-GCM credential encryption
│           ├── db.ts           # Prisma client singleton
│           └── ollama.ts       # Ollama API client
│
├── agent/                      # OpenClaw agent container
│   ├── Dockerfile.openclaw     # Container image definition
│   ├── entrypoint.sh           # Generates workspace files, starts Gateway + Bridge
│   ├── bridge/
│   │   └── index.js            # Translates OpenClaw events → Turk WebSocket protocol
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
- **Must use tool-calling models.** `llama3` does NOT support tools. Use `llama3.1:8b` or newer.
- Models are configured per-turk and routed through Ollama.
- The model name is prefixed with `ollama/` in the OpenClaw config automatically.

### Docker Networking
- All containers run on the `turk_turk-net` bridge network (docker compose prefixes project name).
- Agent containers reach Ollama via `host.docker.internal:11434`.
- Agent containers reach the web server via `host.docker.internal:3124` (WS_URL).
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

### OpenClaw Integration
- Each agent container runs a full OpenClaw instance with Gateway + CLI.
- Workspace files (SOUL.md, AGENTS.md, USER.md, TOOLS.md) are generated from turk config at container start.
- The bridge process spawns `openclaw agent --session-id <id> --message <msg> --json --verbose on` for each turn.
- Agent memory persists across runs via named Docker volumes (`turk-memory-<turkId>`).

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://turk:turk@localhost:5432/turk` |
| `ENCRYPTION_KEY` | 256-bit hex key (required) | Generated by setup.sh |
| `OLLAMA_BASE_URL` | Ollama API | `http://host.docker.internal:11434` |
| `WS_URL` | Agent → web server WebSocket | `ws://host.docker.internal:3124/api/ws` |
| `DOCKER_SOCKET` | Docker socket | `/var/run/docker.sock` |

## Manual Setup

If you prefer not to use `setup.sh`:

```bash
# 1. Create .env from template
cp .env.example .env

# 2. Generate encryption key and set it in .env
openssl rand -hex 32
# Edit .env: ENCRYPTION_KEY=<the key you just generated>

# 3. For local dev, update DATABASE_URL to use localhost
# Edit .env: DATABASE_URL=postgresql://turk:turk@localhost:5432/turk

# 4. Install web dependencies
cd web && npm install && cd ..

# 5. Start PostgreSQL
docker compose up db -d

# 6. Push database schema
cd web && npx prisma db push && cd ..

# 7. Build agent Docker image
docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent

# 8. Make sure Ollama is running and pull a model
ollama pull llama3.1:8b

# 9. Start the web server
cd web && node server.js
```

## Common Issues

- **"ENCRYPTION_KEY environment variable is required"** — Make sure `.env` exists with a valid 64-char hex key.
- **"llama3 does not support tools"** — Use `llama3.1:8b` or another tool-calling model.
- **Agent container can't reach Ollama** — Ensure Ollama is running (`ollama serve`) and accessible from Docker via `host.docker.internal`.
- **Port 3124 already in use** — Kill the existing process: `lsof -ti:3124 | xargs kill`
- **Database connection refused** — Run `docker compose up db -d` first.
- **Prisma schema out of sync** — Run `cd web && npx prisma db push`.
- **Agent image not found** — Run `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent`.

## Development Workflow

1. Make changes to web code → server auto-reloads (if using `npm run dev`) or restart `node server.js`
2. Make changes to agent code → rebuild image: `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent`
3. Make changes to Prisma schema → `cd web && npx prisma db push`
4. Verify builds: `cd web && npx next build`
