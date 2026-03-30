# Turk — AI-Powered Autonomous QA Testing

<div align="center">

<img src="web/public/avatars/turk-6.png" alt="The Turk — AI Employee" width="300" />

*Meet the Turk — your AI employee powered by [OpenClaw](https://openclaw.ai/) + Ollama.*

</div>

---

Turk is an AI-powered autonomous agent platform. Each "turk" is an isolated Docker container running an [OpenClaw](https://openclaw.ai/) agent with a headless browser, an LLM brain (via local Ollama or Ollama Cloud), and a specific role. A Next.js web dashboard manages turks, credentials, projects, and streams live results via WebSocket.

Turks can operate as **QA testers** — navigating your website like a senior QA engineer, clicking through flows, filling forms, monitoring console errors, and reporting bugs with severity levels in real time. They can also operate as **researchers** — browsing the web, gathering data, and saving structured findings to a shared **Memory Bank** that all turks in a project can contribute to.

<div align="center">

<img src="docs/dashboard.png" alt="Turk Dashboard" width="700" />

*One dashboard to hire, direct, and supervise your AI agents.*

</div>

---

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
|  |   :11434    |  — or Ollama Cloud API —               |
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
4. **Custom skills** — `turk-reporter` for structured bug reporting with severity levels, `qa-testing` for systematic QA methodology, and `project-memory` for saving research findings to the shared Memory Bank.

### How the web app works

- **Next.js** app with a custom `server.js` that adds WebSocket support on the same port (3124).
- WebSocket endpoint at `/api/ws?turkId=X&role=agent|browser` handles real-time bidirectional communication.
- Agent sends `agent_update` messages (kinds: `thought`, `action`, `result`, `screenshot`, `error`, `status`, `bug_report`, `memory_entry`).
- Browser sends `user_instruction` and `control` (pause/resume/stop) messages.
- All messages are persisted to PostgreSQL.
- Credentials are encrypted at rest with AES-256-GCM and decrypted only at turk start time.
- Agent memory persists across runs via named Docker volumes (`turk-memory-<turkId>`).
- **Memory Bank** entries are stored in PostgreSQL (`MemoryEntry` table) and shared across all turks in a project.

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
- **[Ollama](https://ollama.ai/)** installed and running locally (or an [Ollama Cloud](https://ollama.com/cloud) subscription)

> **Important:** You must use a model that supports tool calling. `llama3` does NOT work. Use `qwen3:14b`, `llama3.1:8b`, or another tool-calling model.

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

# 3. The .env.example already has the correct local dev defaults:
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

## Models: Local vs Cloud

Turk supports two model sources. You choose per-turk when creating one.

### Local Ollama (default)

Models run on your machine via [Ollama](https://ollama.ai/). The model selector shows what you have installed and lets you pull new ones.

```bash
ollama pull qwen3:14b       # Recommended
ollama pull llama3.1:8b     # Lighter alternative
```

### Ollama Cloud

Run models hosted on [Ollama Cloud](https://ollama.com/cloud) without downloading anything. Useful for large models (e.g., `qwen3-coder:480b`, `deepseek-v3.1:671b`) that won't fit locally.

**Setup (choose one):**

1. **From the UI (recommended):** Go to **Turks -> New Turk**, click the **Ollama Cloud** tab, paste your API key, and click **Save Key**. The key is encrypted and stored in the database.

2. **From `.env`:** Add your key to the `.env` file:
   ```
   OLLAMA_API_KEY=your-key-here
   ```

Get an API key at [ollama.com/settings/keys](https://ollama.com/settings/keys). Ollama Cloud offers a free tier, with Pro ($20/mo) and Max ($100/mo) plans for higher usage.

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
| `OLLAMA_BASE_URL` | Ollama API endpoint (used by the web server on the host). Can also be set from **Settings** page. | `http://localhost:11434` |
| `OLLAMA_API_KEY` | Ollama Cloud API key (optional — can also be set from **Settings** page or new turk UI). DB value takes precedence. | *(empty)* |
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
│   ├── prisma/schema.prisma        # Database schema (Turk, Project, MemoryEntry, etc.)
│   └── src/
│       ├── app/                    # Pages and API routes
│       │   ├── api/turks/[id]/     # start, stop, pause, resume, findings, messages
│       │   ├── api/projects/       # Project CRUD
│       │   ├── api/projects/[id]/memory/  # Memory Bank CRUD + export
│       │   ├── api/ollama/         # models, pull, cloud-models
│       │   ├── api/settings/       # App settings (API keys, Base URL)
│       │   ├── settings/           # Settings page
│       │   └── turks/new/          # Create turk page (model selector + pull UI)
│       ├── components/
│       │   ├── turk-chat.tsx       # Live activity stream + findings + memory entries
│       │   ├── turk-controls.tsx   # Start/pause/resume/stop buttons
│       │   ├── memory-bank.tsx     # Memory Bank viewer + manual entry + export
│       │   ├── sidebar.tsx         # Navigation sidebar
│       │   ├── enhance-instructions.tsx  # AI prompt enhancement
│       │   └── turk-avatar.tsx
│       └── lib/
│           ├── docker.ts           # Container orchestration (Dockerode)
│           ├── encryption.ts       # AES-256-GCM credential encryption
│           ├── db.ts               # Prisma client singleton
│           └── ollama.ts           # Ollama API client (local + cloud, dynamic base URL)
|
└── agent/                          # OpenClaw agent runtime
    ├── Dockerfile.openclaw         # Container: OpenClaw + Chromium + Bridge
    ├── entrypoint.sh               # Generates workspace files, starts all processes
    ├── bridge/
    │   └── index.js                # OpenClaw <-> Turk WebSocket translator
    └── skills/
        ├── turk-reporter/          # Bug reporting skill
        │   └── SKILL.md
        ├── qa-testing/             # QA methodology skill
        │   └── SKILL.md
        └── project-memory/         # Memory Bank skill (saves research findings)
            └── SKILL.md
```

## Usage

### Projects

Organize your turks into projects for better management:

1. Go to **Projects -> + New Project**
2. Give it a name and optional description
3. When creating turks, assign them to the project via the Project dropdown
4. View all turks in a project from its detail page

### Creating a Turk

1. Go to **Turks -> + New Turk**
2. Optionally assign it to a **Project**
3. Give it a name (e.g., "Login Flow Tester")
4. Enter the target URL to test or research
5. Write instructions — be specific:
   - **For QA testing:**
     ```
     Test the login page with valid and invalid credentials.
     Check that error messages display correctly.
     Verify the forgot password flow works end to end.
     ```
   - **For research:** Set a **Turk Role** (e.g., "Stock valuation analyst") and a **Project Objective** (e.g., "Research Adobe stock fundamentals"). The turk will browse the target URL, gather data, and save findings to the project's Memory Bank.
6. Click **"Enhance with AI"** to have Ollama improve your instructions
7. Select a model:
   - **Local Ollama** — pick from models installed locally, or pull a new one
   - **Ollama Cloud** — pick from cloud-hosted models (requires API key; enter it right in the UI)
8. Optionally attach credential groups
9. Click **Create Turk**

### Managing Credentials

1. Go to **Credentials -> + Add Credentials**
2. Name the group (e.g., "Client 1 Login")
3. Add fields (e.g., `Username` -> `admin@example.com`, `Password` -> `secret123` marked as Secret)
4. Save — credentials are encrypted at rest with AES-256-GCM
5. When creating a turk, attach the credential groups it needs

### Memory Bank

The Memory Bank is a shared knowledge base for each project. Turks with a research role automatically save structured findings to the Memory Bank as they browse and gather data.

- **Automatic entries** — Research turks use the `project_memory` tool to save findings with a category, title, content, and source URL.
- **Manual entries** — Click **+ Add Entry** on the Memory Bank tab to add your own notes.
- **Categories** — Entries are tagged with categories like `valuation`, `financial_data`, `news`, `analyst_report`, `risk_factor`, etc.
- **Export** — Click **Export JSON** to download all entries as a JSON file.
- **Cross-turk visibility** — All turks in a project contribute to the same Memory Bank. A "Stock Valuator" turk and a "News Scraper" turk build up a shared research corpus.

Access the Memory Bank from a project's detail page under the **Memory Bank** tab.

### Running a Test or Research Task

1. Open a turk's detail page
2. Click **Start** — this spins up a Docker container with Chromium + OpenClaw + Bridge
3. Watch the **Activity** panel for real-time updates: agent thoughts, actions, screenshots, bugs, and memory entries
4. The agent continues working autonomously (auto-continue loop) until it sends a summary or you stop it
5. Use **Pause** to freeze the agent mid-task, **Resume** to continue
6. Send instructions mid-task via the chat input
7. Switch to the **Findings** tab to see all bugs sorted by severity
8. For research turks, check the project's **Memory Bank** tab to see accumulated findings
9. Click **Copy for Claude Code** to export findings as a prompt for automated fixes
10. Click **Stop** when done

### Settings

The **Settings** page (accessible from the sidebar) lets you configure:

- **Ollama Base URL** — Change where the web server connects to Ollama (default: `http://localhost:11434`). Includes a live health check indicator. This replaces the need to manually edit `.env` for Ollama configuration.
- **Ollama Cloud API Key** — Set or clear your Ollama Cloud API key. The key is encrypted and stored in the database. DB-stored values take precedence over `.env` values.

## Common Issues

| Problem | Fix |
|---|---|
| `ENCRYPTION_KEY environment variable is required` | Make sure `.env` exists at the project root with a valid 64-char hex key, and that `web/.env` is symlinked to it: `ln -sf ../.env web/.env` |
| `Environment variable not found: DATABASE_URL` | Symlink is missing: `ln -sf ../.env web/.env` |
| `llama3 does not support tools` | Use a tool-calling model: `qwen3:14b`, `llama3.1:8b`, etc. |
| Agent container cannot reach Ollama | Make sure Ollama is running (`ollama serve`). Containers reach it via `host.docker.internal:11434`. |
| Ollama API calls fail from the web server | Set `OLLAMA_BASE_URL=http://localhost:11434` in `.env` (not `host.docker.internal` — that is only for containers). |
| Ollama Cloud models not loading | Check that your API key is valid. You can set it from the UI (Turks -> New Turk -> Ollama Cloud tab) or in `.env` as `OLLAMA_API_KEY`. |
| Port 3124 already in use | `lsof -ti:3124 \| xargs kill` |
| Database connection refused | `docker compose up db -d` |
| Prisma schema out of sync | `cd web && npx prisma db push` |
| Agent image not found | `docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent` |
| Next.js cannot find env vars | Symlink the root `.env` into `web/`: `ln -sf ../.env web/.env` |
| `Cannot find module './276.js'` | Stale cache. Run `rm -rf web/.next` and restart the server. |
| Memory Bank not showing entries | Turks need a **Turk Role** and the project needs an **Objective** for research mode. Without these, turks run in QA testing mode and don't save to the Memory Bank. |
| Ollama settings not taking effect | Settings saved in the UI (Settings page) take precedence over `.env` values. Check the Settings page to see current values. |

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

- [x] ~~Cloud LLM support~~ — Ollama Cloud supported
- [x] ~~Project-based organization~~ — Projects feature shipped
- [x] ~~Shared Memory Bank~~ — Research turks save findings to a shared project knowledge base
- [x] ~~UI-configurable settings~~ — Ollama Base URL and API key manageable from Settings page
- [ ] Additional turk types (monitoring agent, data entry agent)
- [ ] Slack integration for notifications and commands
- [ ] Test report generation (PDF/HTML)
- [ ] Scheduled/recurring test runs
- [ ] Screenshot diff comparison between runs
- [ ] Multi-agent parallel testing (OpenClaw sub-agents)
- [ ] Inter-turk coordination within projects
- [ ] Team access controls and audit logging

---

<div align="center">

| <img src="web/public/avatars/turk-2.png" alt="Turk Agent 2" width="200" /> | <img src="web/public/avatars/turk-4.png" alt="Turk Agent 4" width="200" /> | <img src="web/public/avatars/turk-6.png" alt="Turk Agent 6" width="200" /> |
|:---:|:---:|:---:|
| *"I found 47 bugs before my first coffee break."* | *"Your CSS is off by 2 pixels. You're welcome."* | *"I don't sleep. I don't eat. I just test."* |

</div>
