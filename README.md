# Turk — AI Employees

Turk provides AI-powered employees that perform real work autonomously. Each "turk" is an isolated Docker container with a browser, an LLM brain (via local Ollama), and a specific role.

The first turk type is a **Testing Agent** — an autonomous QA tester that navigates your website like a human would, clicking through flows, filling forms, checking for bugs, and reporting issues in real time.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Host Machine                     │
│                                                      │
│  ┌────────────┐                                      │
│  │   Ollama   │  Local LLM (llama3, mistral, etc.)   │
│  │  :11434    │                                      │
│  └─────┬──────┘                                      │
│        │                                             │
│  ══════╪═══════ docker network: turk-net ══════════  │
│  │     │                                          │  │
│  │  ┌──┴───────────┐   ┌────────────┐             │  │
│  │  │   turk-web   │   │ PostgreSQL │             │  │
│  │  │   Next.js    ├──▶│   :5432    │             │  │
│  │  │   :3124      │   └────────────┘             │  │
│  │  └──┬───────────┘                              │  │
│  │     │  WebSocket + Docker API                  │  │
│  │     │                                          │  │
│  │  ┌──┴────────────┐  ┌───────────────┐          │  │
│  │  │ turk-agent-1  │  │ turk-agent-2  │  ...     │  │
│  │  │ Playwright    │  │ Playwright    │          │  │
│  │  │ + Chrome      │  │ + Chrome      │          │  │
│  │  └───────────────┘  └───────────────┘          │  │
│  ═════════════════════════════════════════════════ │  │
└──────────────────────────────────────────────────────┘
```

- **Web app** manages turks and provides a real-time dashboard
- **Each agent** runs in its own container with Playwright + headless Chrome
- **Ollama** runs on the host — agents reach it via `host.docker.internal`
- **WebSocket** provides live communication between the UI and agents
- **Credentials** are AES-256-GCM encrypted at rest

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Ollama](https://ollama.ai/) installed and running locally
- A pulled model (e.g., `ollama pull llama3`)

## Quick Start

```bash
# 1. Clone and enter the project
cd turk

# 2. Copy environment file and generate an encryption key
cp .env.example .env
# Replace ENCRYPTION_KEY with output of: openssl rand -hex 32

# 3. Make sure Ollama is running
ollama serve

# 4. Build the agent Docker image
docker build -t turk-agent ./agent

# 5. Start the web app and database
docker compose up -d

# 6. Run database migrations (first time only)
docker compose exec web npx prisma db push

# 7. Open the dashboard
open http://localhost:3124
```

## Usage

### Creating a Turk

1. Go to **Turks → + New Turk**
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
5. Select an Ollama model
6. Optionally attach credential groups
7. Click **Create Turk**

### Managing Credentials

1. Go to **Credentials → + Add Credentials**
2. Name the group (e.g., "Client 1 Login")
3. Add fields:
   - `Username` → `admin@example.com`
   - `Password` → `secret123` (mark as Secret)
4. Save — credentials are encrypted at rest
5. When creating a turk, attach the credential groups it needs

### Running a Test

1. Open a turk's detail page
2. Click **Start** — this spins up a Docker container with Chrome
3. Watch the **Activity** panel for real-time updates:
   - Agent thoughts (reasoning)
   - Actions taken (navigate, click, fill)
   - Screenshots captured
   - Bugs discovered
4. Send instructions mid-test via the chat input
5. Click **Stop** when done

### What the Agent Tests

The Testing Agent behaves like a human QA tester:

- Navigates the site and explores all reachable pages
- Clicks buttons, fills forms, follows links
- Monitors the browser console for JavaScript errors
- Detects failed network requests
- Verifies text content via assertions
- Reports bugs with severity levels (critical, major, minor, cosmetic)
- Takes screenshots to document findings
- Uses provided credentials to test authenticated flows

## Project Structure

```
turk/
├── docker-compose.yml              # Web + PostgreSQL
├── .env                            # Configuration
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
│       ├── components/             # React components
│       └── lib/                    # Core libraries
│           ├── docker.ts           # Container orchestration
│           ├── ws-manager.ts       # WebSocket routing
│           ├── encryption.ts       # Credential encryption
│           └── ollama.ts           # Ollama client
│
└── agent/                          # Testing agent runtime
    ├── Dockerfile                  # Playwright + Chrome
    └── src/
        ├── index.ts                # Entry point
        ├── browser.ts              # Playwright browser wrapper
        ├── ollama-client.ts        # LLM integration
        ├── task-runner.ts          # Autonomous testing loop
        └── ws-client.ts            # WebSocket client
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://turk:turk@db:5432/turk` |
| `ENCRYPTION_KEY` | 256-bit hex key for credential encryption | — (required) |
| `OLLAMA_BASE_URL` | Ollama API endpoint | `http://host.docker.internal:11434` |
| `DOCKER_SOCKET` | Docker socket path | `/var/run/docker.sock` |

## Development

```bash
# Install web dependencies
cd web && npm install

# Run database locally (requires running Postgres)
npx prisma db push

# Start dev server
npm run dev
```

## Roadmap

- [ ] Additional turk types (monitoring agent, data entry agent, scraping agent)
- [ ] Slack integration for notifications and commands
- [ ] Test report generation (PDF/HTML)
- [ ] Scheduled/recurring test runs
- [ ] Screenshot diff comparison between runs
- [ ] Support for Claude API as an alternative LLM backend
- [ ] Multi-page test plans with step-by-step verification
- [ ] Team access controls and audit logging
