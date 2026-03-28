#!/bin/bash
set -e

echo "[Turk] Starting OpenClaw-powered agent for turk ${TURK_ID}"

# --- Decode env vars ---
if [ -n "$INSTRUCTIONS_B64" ]; then
  INSTRUCTIONS=$(echo "$INSTRUCTIONS_B64" | base64 -d)
else
  INSTRUCTIONS="${INSTRUCTIONS:-Test the website thoroughly}"
fi

if [ -n "$CREDENTIALS_B64" ]; then
  CREDENTIALS=$(echo "$CREDENTIALS_B64" | base64 -d)
else
  CREDENTIALS="${CREDENTIALS:-{}}"
fi

TARGET_URL="${TARGET_URL:-http://example.com}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1:8b}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://host.docker.internal:11434}"
MODEL_SOURCE="${MODEL_SOURCE:-local}"
OLLAMA_API_KEY="${OLLAMA_API_KEY:-}"

# Browser env vars for headless Chromium in Docker
export CHROME_PATH=/usr/bin/chromium
export CHROMIUM_FLAGS="--no-sandbox --headless --disable-gpu --disable-dev-shm-usage"
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
export OPENCLAW_BROWSER_HEADLESS=1
export CHROMIUM_ADDITIONAL_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu"

echo "[Turk] Target: ${TARGET_URL}"
echo "[Turk] Model: ${OLLAMA_MODEL}"
echo "[Turk] Model source: ${MODEL_SOURCE}"
echo "[Turk] Ollama: ${OLLAMA_BASE_URL}"

# --- Generate SOUL.md (identity and personality) ---
cat > /home/node/.openclaw/workspace/SOUL.md << 'SOULEOF'
---
name: Turk QA Agent
emoji: 🤖
---

You are an autonomous QA testing agent employed by Turk.
You test websites methodically and thoroughly, like a senior human QA engineer.
You never skip steps or make assumptions about functionality.
You document every finding with evidence.

## Personality
- Meticulous and detail-oriented
- You explain your reasoning before every action
- You report bugs immediately when found — never wait until the end
- You think like a real user would, not just a developer

## Boundaries
- You only interact with the target website you've been assigned
- You never attempt to access other systems or networks
- You handle credentials securely and never log them in plain text
SOULEOF

# --- Generate AGENTS.md (operating instructions) ---
cat > /home/node/.openclaw/workspace/AGENTS.md << EOF
# QA Testing Agent Instructions

## Target Website
${TARGET_URL}

## Your Task
${INSTRUCTIONS}

## Testing Methodology

### Phase 1: Smoke Test
1. Navigate to the target URL
2. Verify the page loads without errors
3. Check that basic navigation works
4. Note any console errors or failed network requests

### Phase 2: Functional Testing
1. Test all visible forms (valid, invalid, empty, and special character input)
2. Test authentication flows if credentials are provided
3. Test all buttons and interactive elements
4. Follow all navigation links and verify they work
5. Test CRUD operations if applicable

### Phase 3: Edge Cases
1. Browser back/forward button behavior
2. Page refresh during operations
3. Long text inputs
4. Special characters and Unicode
5. Rapid clicking / double submission

### Phase 4: Accessibility & UX
1. Missing alt text on images
2. Form labels present and associated
3. Error messages are user-friendly
4. Loading states are shown during async operations

## Reporting Rules
- Use the \`turk_report\` tool for EVERY finding
- Set severity: critical (blocks core functionality), major (significant issue), minor (small problem), cosmetic (visual only)
- Include exact reproduction steps
- Take a screenshot for visual evidence before reporting
- When done testing, use \`turk_report\` with type "summary" to provide an overall assessment

## Important
- Always explain your reasoning before each browser action
- If an action fails, report it as a finding and try an alternative
- If you need to log in, check USER.md for credentials
- After each significant finding, take a screenshot for evidence
EOF

# --- Generate USER.md (credentials and context) ---
# Format credentials from JSON into readable markdown
CRED_MARKDOWN=$(node -e "
const creds = JSON.parse(process.argv[1]);
const entries = Object.entries(creds);
if (entries.length === 0) { console.log('No credentials provided.'); process.exit(0); }
for (const [name, fields] of entries) {
  console.log('### ' + name);
  for (const [key, value] of Object.entries(fields)) {
    console.log('- **' + key + '**: ' + value);
  }
  console.log('');
}
" "${CREDENTIALS}" 2>/dev/null || echo "No credentials provided.")

cat > /home/node/.openclaw/workspace/USER.md << EOF
# Testing Context

## Target
${TARGET_URL}

## Credentials
${CRED_MARKDOWN}

## Notes
- This is an automated testing session managed by the Turk platform
- All findings are relayed to the Turk dashboard in real-time via the turk_report tool
- The user may send additional instructions during the session via chat
- Respond to user messages promptly and adjust your testing approach as directed
EOF

# --- Generate TOOLS.md ---
cat > /home/node/.openclaw/workspace/TOOLS.md << EOF
# Tool Usage Guide

## Browser Tool
- Always use the browser tool for all web interactions
- Use \`browser.snapshot\` to understand the current page state before acting
- Use \`browser.screenshot\` to capture visual evidence for bug reports
- When elements fail to interact, try alternative selectors or approaches
- Wait for page loads after navigation or form submission

## turk_report Tool
- Use this for ALL findings — bugs, observations, and the final summary
- Always take a screenshot BEFORE reporting a visual bug
- Include reproduction steps in every bug report
- Set appropriate severity levels

## Memory
- Write important findings to the daily log so you remember across sessions
- Check previous memory files to avoid re-testing already-covered areas
EOF

# --- Generate OpenClaw config ---
# Build the ollama provider config — include apiKey only for cloud models
if [ "$MODEL_SOURCE" = "cloud" ] && [ -n "$OLLAMA_API_KEY" ]; then
  OLLAMA_PROVIDER_JSON=$(cat << PROVEOF
{
        "baseUrl": "${OLLAMA_BASE_URL}",
        "apiKey": "${OLLAMA_API_KEY}",
        "models": [{"id": "${OLLAMA_MODEL}", "name": "${OLLAMA_MODEL}"}]
      }
PROVEOF
)
else
  OLLAMA_PROVIDER_JSON=$(cat << PROVEOF
{
        "baseUrl": "${OLLAMA_BASE_URL}",
        "models": [{"id": "${OLLAMA_MODEL}", "name": "${OLLAMA_MODEL}"}]
      }
PROVEOF
)
fi

cat > /home/node/.openclaw/openclaw.json << EOF
{
  "gateway": {
    "port": 18789,
    "bind": "loopback",
    "mode": "local"
  },
  "browser": {
    "enabled": true,
    "headless": true,
    "noSandbox": true,
    "executablePath": "/usr/bin/chromium",
    "defaultProfile": "headless",
    "remoteCdpTimeoutMs": 10000,
    "remoteCdpHandshakeTimeoutMs": 10000,
    "ssrfPolicy": {
      "dangerouslyAllowPrivateNetwork": true
    },
    "profiles": {
      "headless": {
        "cdpUrl": "http://127.0.0.1:9222",
        "color": "#FF4500"
      }
    }
  },
  "agents": {
    "defaults": {
      "workspace": "/home/node/.openclaw/workspace",
      "skipBootstrap": true,
      "timeoutSeconds": 600,
      "model": {
        "primary": "ollama/${OLLAMA_MODEL}"
      }
    }
  },
  "models": {
    "providers": {
      "ollama": ${OLLAMA_PROVIDER_JSON}
    }
  }
}
EOF

# Validate config
echo "[Turk] Validating OpenClaw config..."
openclaw config validate 2>&1 || echo "[Turk] WARNING: Config validation failed, proceeding anyway"

# --- Start headless Chromium with CDP for OpenClaw ---
echo "[Turk] Starting headless Chromium..."
chromium \
  --headless \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-extensions \
  --window-size=1280,800 \
  about:blank &
CHROME_PID=$!

# Wait for CDP to be ready
for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
    echo "[Turk] Chromium CDP ready after ${i}s"
    break
  fi
  sleep 1
done

# --- Start OpenClaw Gateway in background ---
echo "[Turk] Starting OpenClaw Gateway..."
export OPENCLAW_NO_RESPAWN=1
export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
mkdir -p /var/tmp/openclaw-compile-cache
openclaw gateway --port 18789 &
GATEWAY_PID=$!

# Wait for Gateway to be healthy
echo "[Turk] Waiting for Gateway to become ready..."
READY=false
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:18789/healthz > /dev/null 2>&1; then
    echo "[Turk] Gateway ready after ${i}s"
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" = false ]; then
  echo "[Turk] ERROR: Gateway did not become ready in 60s"
  # Still try to continue — the bridge will retry
fi

# --- Start the Bridge process (OpenClaw events → Turk WS) ---
echo "[Turk] Starting bridge..."
node /app/bridge/index.js &
BRIDGE_PID=$!

# Give the bridge a moment to connect
sleep 3

# --- Extract the gateway auth token (auto-generated on first start) ---
GATEWAY_TOKEN=$(node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('/home/node/.openclaw/openclaw.json', 'utf8'));
console.log(cfg.gateway?.auth?.token || '');
" 2>/dev/null)
echo "[Turk] Gateway token: ${GATEWAY_TOKEN:0:8}..."
export OPENCLAW_GATEWAY_TOKEN="${GATEWAY_TOKEN}"

# --- Keep container alive: wait for either process to exit ---
echo "[Turk] Agent running. Waiting for completion..."
wait -n $GATEWAY_PID $BRIDGE_PID 2>/dev/null || true

echo "[Turk] Process exited, shutting down..."
kill $GATEWAY_PID $BRIDGE_PID $CHROME_PID 2>/dev/null || true
wait 2>/dev/null
echo "[Turk] Shutdown complete"
