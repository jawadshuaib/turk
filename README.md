# Turk — AI-Powered Autonomous QA Testing

<div align="center">

<img src="web/public/avatars/turk-6.png" alt="The Turk — AI Employee" width="300" />

*Meet the Turk — your AI employee powered by [OpenClaw](https://openclaw.ai/) + Ollama.*

</div>

---

Turk is an AI-powered autonomous QA testing platform. Each "turk" is an isolated Docker container running an [OpenClaw](https://openclaw.ai/) agent with a headless browser, an LLM brain (via local Ollama), and a specific testing role. A Next.js web dashboard manages turks, credentials, and streams live results via WebSocket.

The Testing Agent navigates your website like a senior QA engineer — clicking through flows, filling forms, monitoring console errors, detecting failed network requests, and reporting bugs with severity levels in real time.

<div align="center">

| <img src="web/public/avatars/turk-1.png" alt="Turk Agent 1" width="200" /> | <img src="web/public/avatars/turk-3.png" alt="Turk Agent 3" width="200" /> | <img src="web/public/avatars/turk-5.png" alt="Turk Agent 5" width="200" /> |
|:---:|:---:|:---:|
| *The Gentleman Tester* | *The Vintage Inspector* | *The Mechanical QA* |

</div>

## Architecture

```
+---------------------------------------------------------+
|                      Host Machine                       |
|                                                         |
|  +-------------+                                        |
|  |   Ollama    |  Local LLM (qwen3:14b, llama3.1, etc.) |
|  |   :11434    |                                        |
|  +------+------+                                        |
|         |                                               |
|  =======|======== docker network: turk-net =========    |
|  |      |                                          |    |
|  |  +---+-----------+   +--------------+           |    |
|  |  |   turk-web    |   |  PostgreSQL  |           |    |
|  |  |   Next.js     +-->|    :5432     |           |    |
|  |  |   :3124       |   +--------------+           |    |
|  |  +---+-----------+                              |    |
|  |      |  WebSocket + Docker API                  |    |
|  |      |                                          |    |
|  |  +---+-------------------+  +----------------+  |    |
|  |  | turk-agent-1          |  | turk-agent-2   |  |    |
|  |  | OpenClaw Gateway      |  | OpenClaw       |  |    |
|  |  | + Bridge + Chromium   |  | + Bridge       |  |    |
|  |  | + Skills + Memory     |  | + Chromium     |  |    |
|  |  +-----------------------+  +----------------+  |    |
|  ===================================================    |
+---------------------------------------------------------+
```

### How the agent container works

Each agent container runs these processes:

1. **Chromium (headless)** — Pre-launched at container start with Chrome DevTools Protocol (CDP) exposed on port 9222. OpenClaw connects to it via a remote CDP profile rather than launching its own browser.
2. **OpenClaw Gateway** — The AI agent runtime providing the ReAct loop (reason, act, observe, repeat), tool calling, and persistent memory.
3. **Bridge process** (`agent/bridge/index.js`) — Translates OpenClaw events into Turk's WebSocket protocol. The bridge has an **auto-continue loop** that keeps the agent testing autonomously until it sends a summary or is stopped manually.
4. **Custom skills** — `turk-reporter` for structured bug reporting with severity levels, `qa-testing` for systematic QA methodology.

### How the web app works

- **Next.js** app with a custom `server.js` that adds WebSocket support on the same port (3124).
- WebSocket endpoint at `/api/ws?turkId=X&role=agent|browser` handles real-time bidirectional communication.
- Agent sends `agent_update` messages (kinds: `thought`, `action`, `result`, `screenshot`, `error`, `status`, `bug_report`).
- Browser sends `user_instruction` and `control` (pause/resume/stop) messages.
- All messages are persisted to PostgreSQL.
- Credentials are encrypted at rest with AES-256-GCM and decrypted only at turk start time.
- Agent memory persists across runs via named Docker volumes (`turk-memory-<turkId>`).

### How OpenClaw powers each turk

When you click "Start" on a turk:

1. **Workspace files are generated** from your turk's config: `SOUL.md` (agent identity), `AGENTS.md` (testing instructions), `USER.md` (credentials/context), `TOOLS.md` (tool guidance).
2. **The container starts** with Chromium, OpenClaw Gateway, and the Bridge process.
3. **The bridge connects** to the web server via WebSocket and sends the initial prompt.
4. **The agent begins testing** autonomously, streaming events in real time.
5. **The auto-continue loop** keeps the agent working until it sends a summary or you click Stop.

## Prerequisites

- **[Docker](https://docs.docker.com/get-docker/)** and Docker Compose
- **[Node.js](https://nodejs.org/)** 18+
- **[Ollama](https://ollama.ai/)** installed and running locally

> **Important:** You must use a model that supports tool calling. `llama3` does NOT work. Use `qwen3:14b`, `llama3.1:8b`, or another tool-calling model. The model selection UI in the app shows only models currently available in your Ollama installation and offers a "Pull a different model" option.

## Quick Start (Automated)

```bash
git clone <repo-url> turk
cd turk
chmod +x setup.sh && ./setup.sh
```

The setup script handles:
- Checking prerequisites (Docker, Node.js, Ollama)
- Creating `.env` with a generated encryption key
- Installing web dependencies (`npm install`)
- Starting PostgreSQL and pushing the database schema
- Building the OpenClaw agent Docker image
- Pulling a tool-calling Ollama model if none found

**After setup.sh completes, do these two manual steps:**

```bash
# 1. Symlink .env into the web/ directory (Next.js needs it there)
ln -sf ../.env web/.env

# 2. Fix OLLAMA_BASE_URL for local development
#    Edit .env and change:
#      OLLAMA_BASE_URL=http://host.docker.internal:11434
#    to:
#      OLLAMA_BASE_URL=http://localhost:11434
#
#    (host.docker.internal is for containers; the web server runs on the host)
```

Then start the app:

```bash
# Make sure Ollama is running
ollama serve

# Make sure the database is running
docker compose up db -d

# Start the web server
cd web && node server.js
```

Open **http://localhost:3124** in your browser.

## Manual Setup

If you prefer not to use `setup.sh`:

```bash
# 1. Create .env from template
cp .env.example .env

# 2. Generate an encryption key and set it in .env
#    Run: openssl rand -hex 32
#    Then edit .env and set ENCRYPTION_KEY=<the output>

# 3. Configure .env for local development
#    Edit .env and set:
#      DATABASE_URL=postgresql://turk:turk@localhost:5432/turk
#      OLLAMA_BASE_URL=http://localhost:11434
#      WS_URL=ws://host.docker.internal:3124/api/ws

# 4. Symlink .env into the web/ directory (Next.js needs it there)
ln -sf ../.env web/.env

# 5. Install web dependencies
cd web && npm install && cd ..

# 6. Start PostgreSQL
docker compose up db -d

# 7. Push database schema
cd web && npx prisma db push && cd ..

# 8. Build the agent Docker image
docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent

# 9. Make sure Ollama is running and pull a tool-calling model
ollama serve
ollama pull qwen3:14b    # or llama3.1:8b

# 10. Start the web server
cd web && node server.js
```

Open **http://localhost:3124**.

## Key Commands

| Task | Command |
|---|---|
| Start database | `docker compose up db -d` |
| Start web server | `cd web && node server.js` |
| Build agent image | `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent` |
| Run DB migrations | `cd web && npx prisma db push` |
| Generate Prisma client | `cd web && npx prisma generate` |
| Production build check | `cd web && npx next build` |
| Check available Ollama models | `curl -s http://localhost:11434/api/tags` |
| Pull a model | `ollama pull qwen3:14b` |
| Kill process on port 3124 | `lsof -ti:3124 \| xargs kill` |
| Symlink .env for Next.js | `ln -sf ../.env web/.env` |

## Environment Variables

The `.env` file lives at the project root. It must be symlinked into `web/` so Next.js can read it.

| Variable | Description | Local Dev Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://turk:turk@localhost:5432/turk` |
| `ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM credential encryption (required) | Generated by `setup.sh` or `openssl rand -hex 32` |
| `OLLAMA_BASE_URL` | Ollama API endpoint (used by the web server on the host) | `http://localhost:11434` |
| `WS_URL` | WebSocket URL for agent containers to reach the web server | `ws://host.docker.internal:3124/api/ws` |
| `DOCKER_SOCKET` | Docker socket path | `/var/run/docker.sock` |

**Key distinction:** `OLLAMA_BASE_URL` should be `http://localhost:11434` because the web server runs on the host machine and talks to Ollama directly. Agent containers reach Ollama via `host.docker.internal:11434` (this is handled automatically by the container configuration). Similarly, `WS_URL` uses `host.docker.internal` because it is the agent containers that use this value to connect back to the web server.

> **Note:** When you enter `localhost` in a turk's target URL, `docker.ts` automatically rewrites it to `host.docker.internal` so agent containers can reach services on your host machine.

## Project Structure

```
turk/
├── setup.sh                        # Automated setup (run this first)
├── CLAUDE.md                       # Claude Code project guide
├── docker-compose.yml              # PostgreSQL service
├── .env.example                    # Configuration template
├── .env                            # Your local config (gitignored)
|
├── shared/                         # Shared TypeScript types
│   └── src/
│       ├── message-types.ts        # WebSocket protocol types
│       └── turk-config.ts          # Turk configuration interfaces
|
├── web/                            # Next.js app (UI + API + WebSocket server)
│   ├── .env -> ../.env             # Symlink to root .env (create manually)
│   ├── server.js                   # Custom HTTP + WebSocket server (entry point)
│   ├── package.json
│   ├── prisma/schema.prisma        # Database schema
│   └── src/
│       ├── app/                    # Pages and API routes
│       │   └── api/turks/[id]/
│       │       ├── start/          # Start agent container
│       │       ├── stop/           # Stop agent container
│       │       ├── pause/          # Pause agent
│       │       ├── resume/         # Resume agent
│       │       └── findings/       # Bug reports and findings
│       ├── components/
│       │   ├── turk-chat.tsx       # Live activity stream + findings
│       │   ├── turk-controls.tsx   # Start/pause/resume/stop buttons
│       │   ├── enhance-instructions.tsx  # AI prompt enhancement
│       │   └── turk-avatar.tsx
│       └── lib/
│           ├── docker.ts           # Container orchestration (Dockerode)
│           ├── encryption.ts       # AES-256-GCM credential encryption
│           ├── db.ts               # Prisma client singleton
│           └── ollama.ts           # Ollama API client
|
└── agent/                          # OpenClaw agent runtime
    ├── Dockerfile.openclaw         # Container: OpenClaw + Chromium + Bridge
    ├── entrypoint.sh               # Generates workspace files, starts all processes
    ├── bridge/
    │   └── index.js                # OpenClaw <-> Turk WebSocket translator
    └── skills/
        ├── turk-reporter/          # Bug reporting skill
        │   └── SKILL.md
        └── qa-testing/             # QA methodology skill
            └── SKILL.md
```

## Usage

### Creating a Turk

1. Go to **Turks -> + New Turk**
2. Give it a name (e.g., "Login Flow Tester")
3. Enter the target URL to test
4. Write testing instructions — be specific:
   ```
   Test the login page with valid and invalid credentials.
   Check that error messages display correctly.
   Verify the forgot password flow works end to end.
   Test that the session persists after page refresh.
   Check all navigation links on the dashboard.
   ```
5. Click **"Enhance with AI"** to have Ollama improve your instructions
6. Select an Ollama model (the dropdown shows only models available in your Ollama installation; use the "Pull a different model" option if needed)
7. Optionally attach credential groups
8. Click **Create Turk**

### Managing Credentials

1. Go to **Credentials -> + Add Credentials**
2. Name the group (e.g., "Client 1 Login")
3. Add fields (e.g., `Username` -> `admin@example.com`, `Password` -> `secret123` marked as Secret)
4. Save — credentials are encrypted at rest with AES-256-GCM
5. When creating a turk, attach the credential groups it needs

### Running a Test

1. Open a turk's detail page
2. Click **Start** — this spins up a Docker container with Chromium + OpenClaw + Bridge
3. Watch the **Activity** panel for real-time updates: agent thoughts, actions, screenshots, bugs
4. The agent continues testing autonomously (auto-continue loop) until it sends a summary or you stop it
5. Use **Pause** to freeze the agent mid-test, **Resume** to continue
6. Send instructions mid-test via the chat input
7. Switch to the **Findings** tab to see all bugs sorted by severity
8. Click **Copy for Claude Code** to export findings as a prompt for automated fixes
9. Click **Stop** when done

## Common Issues

| Problem | Fix |
|---|---|
| `ENCRYPTION_KEY environment variable is required` | Make sure `.env` exists at the project root with a valid 64-char hex key, and that `web/.env` is symlinked to it: `ln -sf ../.env web/.env` |
| `llama3 does not support tools` | Use a tool-calling model: `qwen3:14b`, `llama3.1:8b`, etc. |
| Agent container cannot reach Ollama | Make sure Ollama is running (`ollama serve`). Containers reach it via `host.docker.internal:11434`. |
| Ollama API calls fail from the web server | Set `OLLAMA_BASE_URL=http://localhost:11434` in `.env` (not `host.docker.internal` — that is only for containers). |
| Port 3124 already in use | `lsof -ti:3124 \| xargs kill` |
| Database connection refused | `docker compose up db -d` |
| Prisma schema out of sync | `cd web && npx prisma db push` |
| Agent image not found | `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent` |
| Next.js cannot find env vars | Symlink the root `.env` into `web/`: `ln -sf ../.env web/.env` |

## Development Workflow

1. **Web code changes** — Restart `cd web && node server.js` (or use `npm run dev` for auto-reload).
2. **Agent code changes** — Rebuild the image: `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent`
3. **Prisma schema changes** — `cd web && npx prisma db push`
4. **Verify production build** — `cd web && npx next build`

## Docker Networking Details

- All containers run on the `turk_turk-net` bridge network (Docker Compose prefixes the project name).
- Agent containers reach Ollama via `host.docker.internal:11434`.
- Agent containers reach the web server via `host.docker.internal:3124` (the `WS_URL` env var).
- The web server itself runs on the host, so it uses `localhost` for Ollama and the database.
- `localhost` in turk target URLs is automatically rewritten to `host.docker.internal` by `docker.ts`.

## Roadmap

- [ ] Additional turk types (monitoring agent, data entry agent, scraping agent)
- [ ] Slack integration for notifications and commands
- [ ] Test report generation (PDF/HTML)
- [ ] Scheduled/recurring test runs
- [ ] Screenshot diff comparison between runs
- [ ] Cloud LLM support (Claude, GPT) via OpenClaw's provider system
- [ ] Multi-agent parallel testing (OpenClaw sub-agents)
- [ ] Team access controls and audit logging

---

<div align="center">

| <img src="web/public/avatars/turk-2.png" alt="Turk Agent 2" width="200" /> | <img src="web/public/avatars/turk-4.png" alt="Turk Agent 4" width="200" /> | <img src="web/public/avatars/turk-6.png" alt="Turk Agent 6" width="200" /> |
|:---:|:---:|:---:|
| *"I found 47 bugs before my first coffee break."* | *"Your CSS is off by 2 pixels. You're welcome."* | *"I don't sleep. I don't eat. I just test."* |

</div>
