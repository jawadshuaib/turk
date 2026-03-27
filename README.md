# Turk — AI Employees

<div align="center">

<img src="https://upload.wikimedia.org/wikipedia/commons/6/6e/Racknitz_-_The_Turk_3.jpg" alt="The Mechanical Turk — a chess-playing automaton from 1770" width="500" />

*The original Mechanical Turk (1770) — a chess-playing "automaton" by Wolfgang von Kempelen.
Spoiler: there was a human hiding inside. Ours uses [OpenClaw](https://openclaw.ai/) instead.*

</div>

---

Turk provides AI-powered employees that perform real work autonomously. Each "turk" is an isolated Docker container running an [OpenClaw](https://openclaw.ai/) agent with a browser, an LLM brain (via local Ollama or cloud providers), and a specific role.

The first turk type is a **Testing Agent** — an autonomous QA tester that navigates your website like a human would, clicking through flows, filling forms, checking for bugs, and reporting issues in real time.

<div align="center">

| <img src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Tuerkischer_schachspieler_racknitz3.jpg" alt="Interior of the Mechanical Turk" width="280" /> | <img src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Kempelen_chess1.jpg" alt="The Turk playing chess" width="280" /> |
|:---:|:---:|
| *Inside the machine — our turks have nothing to hide (except encrypted credentials)* | *The Turk in action — just like our agents browsing your website* |

</div>

## Architecture

```
+---------------------------------------------------------+
|                      Host Machine                       |
|                                                         |
|  +-------------+                                        |
|  |   Ollama    |  Local LLM (llama3.1, mistral, etc.)   |
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

Each agent container runs:
- **OpenClaw Gateway** — the AI agent runtime with ReAct loop, tool calling, and memory
- **Bridge process** — translates OpenClaw events into Turk's WebSocket protocol
- **Chromium** — headless browser controlled by OpenClaw's built-in browser tool
- **Custom skills** — `turk-reporter` for logging bugs, `qa-testing` for methodology

The web app provides:
- **Real-time dashboard** with live WebSocket activity stream
- **AES-256-GCM encrypted** credential storage
- **Persistent memory** per turk via Docker volumes (agents learn across runs)
- **"Enhance with AI"** — Ollama-powered prompt enhancement for instructions

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Ollama](https://ollama.ai/) installed and running locally
- [Node.js](https://nodejs.org/) 18+ (for local development)

> **Important:** `llama3` does NOT support tool calling. Use `llama3.1:8b` or newer.

## Quick Start

### Automated Setup (recommended)

```bash
git clone <repo-url> turk
cd turk
chmod +x setup.sh && ./setup.sh
```

The setup script handles everything:
- Checks prerequisites (Docker, Node.js, Ollama)
- Creates `.env` with a generated encryption key
- Installs web dependencies
- Starts PostgreSQL and pushes the database schema
- Builds the OpenClaw agent Docker image
- Pulls a tool-calling Ollama model if none found

Then start the app:

```bash
ollama serve          # if not already running
cd web && node server.js
open http://localhost:3124
```

### Using Claude Code

If you have [Claude Code](https://claude.com/claude-code), you can set up the entire project with a single prompt:

```
Clone and set up this project. Run setup.sh to configure everything, then start the web server.
```

Claude Code reads `CLAUDE.md` for project context and knows how to run all the setup commands.

### Manual Setup

```bash
# 1. Clone and enter
cd turk

# 2. Create env file and generate encryption key
cp .env.example .env
# Set ENCRYPTION_KEY to output of: openssl rand -hex 32
# Change DATABASE_URL to use localhost instead of db

# 3. Make sure Ollama is running with a tool-capable model
ollama serve
ollama pull llama3.1:8b

# 4. Build the OpenClaw agent Docker image
docker build -t turk-openclaw -f agent/Dockerfile.openclaw ./agent

# 5. Start PostgreSQL
docker compose up db -d

# 6. Install deps and push schema
cd web && npm install && npx prisma db push

# 7. Start the web server
node server.js
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
6. Select an Ollama model (must support tool calling — `llama3.1:8b` or newer)
7. Optionally attach credential groups
8. Click **Create Turk**

### Managing Credentials

1. Go to **Credentials -> + Add Credentials**
2. Name the group (e.g., "Client 1 Login")
3. Add fields:
   - `Username` -> `admin@example.com`
   - `Password` -> `secret123` (mark as Secret)
4. Save — credentials are encrypted at rest
5. When creating a turk, attach the credential groups it needs

### Running a Test

1. Open a turk's detail page
2. Click **Start** — this spins up a Docker container with OpenClaw + Chrome
3. Watch the **Activity** panel for real-time updates:
   - Agent thoughts (reasoning)
   - Actions taken (navigate, click, fill)
   - Screenshots captured
   - Bugs discovered
4. Use **Pause** to freeze the agent mid-test, **Resume** to continue
5. Send instructions mid-test via the chat input
6. Switch to the **Findings** tab to see all bugs sorted by severity
7. Click **Copy for Claude Code** to export findings as a prompt for automated fixes
8. Click **Stop** when done

### What the Agent Tests

The Testing Agent behaves like a senior human QA engineer:

- Navigates the site and explores all reachable pages
- Clicks buttons, fills forms, follows links
- Monitors the browser console for JavaScript errors
- Detects failed network requests
- Reports bugs with severity levels (critical, major, minor, cosmetic)
- Takes screenshots to document findings
- Uses provided credentials to test authenticated flows
- **Remembers** findings across runs (persistent memory via Docker volumes)
- Follows a systematic methodology (smoke test -> functional -> edge cases -> accessibility)

## Project Structure

```
turk/
├── setup.sh                        # Automated setup (run this first)
├── CLAUDE.md                       # Claude Code project guide
├── docker-compose.yml              # Web + PostgreSQL
├── .env.example                    # Configuration template
│
├── shared/                         # Shared TypeScript types
│   └── src/
│       ├── message-types.ts        # WebSocket protocol
│       └── turk-config.ts          # Turk configuration
│
├── web/                            # Next.js app (UI + API)
│   ├── Dockerfile
│   ├── server.js                   # Custom server (WebSocket support)
│   ├── prisma/schema.prisma        # Database schema
│   └── src/
│       ├── app/                    # Pages and API routes
│       │   └── api/turks/[id]/
│       │       ├── start/          # Start agent container
│       │       ├── stop/           # Stop agent container
│       │       ├── pause/          # Pause agent
│       │       ├── resume/         # Resume agent
│       │       └── findings/       # Bug reports & findings
│       ├── components/
│       │   ├── turk-chat.tsx       # Live activity stream + findings
│       │   ├── turk-controls.tsx   # Start/pause/resume/stop buttons
│       │   ├── enhance-instructions.tsx  # AI prompt enhancement
│       │   └── turk-avatar.tsx
│       └── lib/
│           ├── docker.ts           # Container orchestration
│           ├── encryption.ts       # AES-256-GCM credential encryption
│           └── db.ts               # Prisma client
│
└── agent/                          # OpenClaw agent runtime
    ├── Dockerfile.openclaw         # OpenClaw + Chromium + Bridge
    ├── entrypoint.sh               # Generates workspace, starts Gateway
    ├── bridge/
    │   └── index.js                # OpenClaw <-> Turk WS translator
    └── skills/
        ├── turk-reporter/          # Bug reporting skill
        │   └── SKILL.md
        └── qa-testing/             # QA methodology skill
            └── SKILL.md
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://turk:turk@db:5432/turk` |
| `ENCRYPTION_KEY` | 256-bit hex key for credential encryption | — (required, auto-generated by setup.sh) |
| `OLLAMA_BASE_URL` | Ollama API endpoint | `http://host.docker.internal:11434` |
| `WS_URL` | WebSocket URL for agent containers | `ws://host.docker.internal:3124/api/ws` |
| `DOCKER_SOCKET` | Docker socket path | `/var/run/docker.sock` |

> **Note:** When running locally, `localhost` in target URLs is automatically rewritten to `host.docker.internal` so agent containers can reach services on your host machine.

## How OpenClaw Powers Each Turk

Each turk container runs a full [OpenClaw](https://openclaw.ai/) instance. When you click "Start":

1. **Workspace files are generated** from your turk's config:
   - `SOUL.md` — agent identity and personality
   - `AGENTS.md` — your testing instructions + methodology
   - `USER.md` — credentials and context
   - `TOOLS.md` — tool usage guidance
2. **OpenClaw Gateway starts** inside the container
3. **Bridge process connects** the Gateway to the Turk web server via WebSocket
4. **Initial prompt is sent** — the agent begins testing
5. **Events stream in real-time** — thoughts, actions, bug reports, screenshots

The agent uses OpenClaw's ReAct loop (reason -> act -> observe -> repeat) with:
- Built-in **browser tool** (CDP-based, more capable than raw Playwright)
- Built-in **memory system** (daily + long-term `.md` files persisted across runs)
- Custom **turk-reporter skill** for structured bug reporting
- Custom **qa-testing skill** with systematic methodology

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

| <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Turk-engraving5.jpg" alt="Copper engraving of the Mechanical Turk" width="300" /> | <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Racknitz_-_The_Turk_2.jpg/440px-Racknitz_-_The_Turk_2.jpg" alt="The Turk's mechanism" width="300" /> |
|:---:|:---:|
| *"Any sufficiently advanced automation is indistinguishable from a tiny person hiding in a box."* | *The mechanism revealed — 254 years later, the mechanism is OpenClaw + Ollama* |

</div>
