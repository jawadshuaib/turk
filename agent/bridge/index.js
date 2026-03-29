/**
 * Turk ↔ OpenClaw Bridge
 *
 * Connects to Turk Web WS to relay agent updates.
 * Uses OpenClaw CLI (with --json) to communicate with the Gateway.
 *
 * Architecture:
 *   - Turk WS → receives user instructions and control commands
 *   - OpenClaw CLI → sends messages to and gets responses from the agent
 *   - Translates CLI JSON output into Turk agent_update protocol
 */

const WebSocket = require("ws");
const { spawn, execSync } = require("child_process");
const fs = require("fs");

const TURK_ID = process.env.TURK_ID;
const WS_URL = process.env.WS_URL || "ws://host.docker.internal:3124/api/ws";
const SESSION_ID = `turk-${TURK_ID}`;
const TARGET_URL = process.env.TARGET_URL || "the target website";
const hasProjectRole = !!process.env.TURK_ROLE_B64 || !!process.env.PROJECT_OBJECTIVE_B64;

if (!TURK_ID) {
  console.error("[Bridge] Missing TURK_ID");
  process.exit(1);
}

// Read the auth token from the OpenClaw config
let GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
function refreshToken() {
  try {
    const cfg = JSON.parse(
      fs.readFileSync("/home/node/.openclaw/openclaw.json", "utf8")
    );
    GATEWAY_TOKEN = cfg.gateway?.auth?.token || GATEWAY_TOKEN;
  } catch {
    // keep existing token
  }
}
refreshToken();

// Track state
let stepCount = 0;
let isPaused = false;
let pendingMessages = []; // queued during pause
let turkWs = null;
let agentBusy = false; // true while an openclaw agent command is running
let completionSent = false; // true when agent sends a summary/completion

// ─── Turk WebSocket ──────────────────────────────────────────────────────────

function connectToTurk() {
  const url = `${WS_URL}?turkId=${TURK_ID}&role=agent`;
  console.log(`[Bridge] Connecting to Turk: ${url}`);

  turkWs = new WebSocket(url);

  turkWs.on("open", () => {
    console.log("[Bridge] Connected to Turk web server");
    sendToTurk({ kind: "status", status: "running" });
  });

  turkWs.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleTurkMessage(msg);
    } catch (e) {
      console.error("[Bridge] Parse error:", e.message);
    }
  });

  turkWs.on("close", () => {
    console.log("[Bridge] Turk WS disconnected, reconnecting in 5s...");
    setTimeout(connectToTurk, 5000);
  });

  turkWs.on("error", (err) => {
    console.error("[Bridge] Turk WS error:", err.message);
  });
}

function sendToTurk(data) {
  if (turkWs && turkWs.readyState === WebSocket.OPEN) {
    turkWs.send(
      JSON.stringify({
        type: "agent_update",
        turkId: TURK_ID,
        data,
      })
    );
  }
}

function handleTurkMessage(msg) {
  if (msg.type === "user_instruction" && msg.content) {
    console.log(`[Bridge] User instruction: ${msg.content}`);
    if (isPaused) {
      pendingMessages.push(msg.content);
      sendToTurk({
        kind: "thought",
        content:
          "Received your instruction. I'm paused — will process when resumed.",
      });
    } else {
      sendToOpenClaw(msg.content);
    }
  } else if (msg.type === "control") {
    switch (msg.action) {
      case "pause":
        isPaused = true;
        sendToTurk({ kind: "status", status: "paused" });
        console.log("[Bridge] Paused");
        break;
      case "resume":
        isPaused = false;
        sendToTurk({ kind: "status", status: "running" });
        console.log("[Bridge] Resumed");
        if (pendingMessages.length > 0) {
          const combined = pendingMessages.join("\n");
          pendingMessages = [];
          sendToOpenClaw(combined);
        } else {
          sendToOpenClaw(
            hasProjectRole
              ? "Continue your research from where you left off."
              : "Continue testing from where you left off."
          );
        }
        break;
      case "stop":
        sendToTurk({
          kind: "status",
          status: "completed",
          content: "Stopped by user",
          summary: "Stopped by user",
          stepCount,
        });
        console.log("[Bridge] Stopped by user, exiting...");
        setTimeout(() => process.exit(0), 2000);
        break;
    }
  }
}

// ─── OpenClaw CLI Communication ──────────────────────────────────────────────

function sendToOpenClaw(message) {
  if (agentBusy) {
    console.log("[Bridge] Agent busy, queueing message");
    pendingMessages.push(message);
    return;
  }

  if (isPaused) return;

  agentBusy = true;
  sendToTurk({ kind: "thought", content: "Processing..." });

  console.log(`[Bridge] → OpenClaw: ${message.substring(0, 120)}`);

  const args = [
    "agent",
    "--session-id",
    SESSION_ID,
    "--message",
    message,
    "--json",
    "--verbose",
    "on",
    "--timeout",
    "600",
  ];

  const child = spawn("openclaw", args, {
    env: {
      ...process.env,
      OPENCLAW_GATEWAY_TOKEN: GATEWAY_TOKEN,
      OPENCLAW_NO_RESPAWN: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let jsonBuffer = ""; // Buffer for incomplete JSON lines

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;

    // Append to buffer and try to extract complete JSON lines
    jsonBuffer += text;
    const lines = jsonBuffer.split("\n");
    // Keep the last (potentially incomplete) line in the buffer
    jsonBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed);
        handleOpenClawEvent(event);
      } catch {
        // Check for OpenClaw's text-format tool calls:
        // "assistant commentary to=functions.project_memory json {...}"
        const toolCallMatch = trimmed.match(/to=functions\.(\S+)\s+json\s+(.+)/);
        if (toolCallMatch) {
          try {
            const toolName = toolCallMatch[1];
            const toolArgs = JSON.parse(toolCallMatch[2]);
            handleToolCall({ name: toolName, input: toolArgs });
          } catch {
            // JSON parse of args failed, send as thought
            if (isMeaningfulText(trimmed)) {
              sendToTurk({ kind: "thought", content: trimmed });
            }
          }
        } else if (isMeaningfulText(trimmed)) {
          // Not valid JSON — only forward if it looks like meaningful text
          // (not raw JSON fragments like `},` or `"name": "foo",`)
          sendToTurk({ kind: "thought", content: trimmed });
        }
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderr += text;
    // Only forward actual errors, not routine warnings
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.includes("timed out") || trimmed.includes("[tools]"))) {
        sendToTurk({ kind: "error", message: trimmed.substring(0, 300) });
      }
    }
  });

  child.on("close", (code) => {
    agentBusy = false;

    if (code !== 0) {
      console.error(`[Bridge] OpenClaw exited with code ${code}`);
      if (stderr) console.error(`[Bridge] stderr: ${stderr.substring(0, 500)}`);

      // Try to extract useful error info
      const errorMsg = stderr || stdout || `Agent exited with code ${code}`;
      sendToTurk({
        kind: "error",
        message: errorMsg.substring(0, 300),
      });
    }

    // If there's a final JSON response that wasn't streamed
    if (stdout && !stdout.includes("{")) {
      // Plain text response
      sendToTurk({ kind: "thought", content: stdout.trim() });
    }

    // Process any pending messages, or auto-continue testing
    if (!isPaused) {
      if (pendingMessages.length > 0) {
        const next = pendingMessages.shift();
        setTimeout(() => sendToOpenClaw(next), 1000);
      } else if (!completionSent) {
        // Auto-continue: send a follow-up prompt
        setTimeout(() => {
          if (!isPaused && !completionSent) {
            if (hasProjectRole) {
              sendToOpenClaw(
                "Continue your research from where you left off. " +
                "If you've found new data, save it with project_memory. " +
                "If you've covered everything, provide a final summary using turk_report with type 'summary'."
              );
            } else {
              sendToOpenClaw(
                "Continue testing from where you left off. " +
                "If the browser failed, try a different approach. " +
                "If you've covered all test phases, provide a final summary using turk_report with type 'summary'."
              );
            }
          }
        }, 3000);
      }
    }

    console.log(`[Bridge] OpenClaw turn complete (code: ${code})`);
  });
}

// ─── Noise Filtering ────────────────────────────────────────────────────────

// JSON fragments and internal metadata that should not be shown to the user
const NOISE_PATTERNS = [
  /^[{}\[\],]+$/, // bare braces/brackets
  /^"[a-zA-Z]+"\s*:/, // JSON property fragments like `"name": "foo",`
  /^[0-9]+$/, // bare numbers
  /^\s*\}?\s*,?\s*$/, // closing braces with commas
  /schemaChars/i,
  /propertiesCount/i,
  /summaryChars/i,
  /^Config (?:valid|overwrite|write)/i,
  /missing-meta-before-write/,
  /^\[(?:heartbeat|health-monitor|canvas|gateway)\]/,
  /DEPRECATED_ENDPOINT/,
  /dbus\/bus\.cc/,
  /object_proxy\.cc/,
  /vkCreateInstance/,
  /on_device_model/,
];

function isMeaningfulText(text) {
  // Must be at least a short sentence
  if (text.length < 15) return false;
  // Filter out noise patterns
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(text)) return false;
  }
  // Must contain at least one space (real sentences do)
  if (!text.includes(" ")) return false;
  return true;
}

// ─── Event Translation ───────────────────────────────────────────────────────

function handleOpenClawEvent(event) {
  // The --json output can be:
  // 1. A single response object with { role, content, ... }
  // 2. Streaming events with { type, ... }
  // 3. Tool call objects with { tool_calls: [...] }

  // Full response object
  if (event.role === "assistant" && event.content) {
    parseAssistantContent(event.content);
    return;
  }

  // Tool calls in the response
  if (event.tool_calls || event.tools) {
    const calls = event.tool_calls || event.tools || [];
    for (const call of calls) {
      handleToolCall(call);
    }
    return;
  }

  // Streaming event types
  const type = event.type || event.event || event.kind;
  switch (type) {
    case "text_delta":
    case "delta":
    case "content_block_delta": {
      const text = event.delta?.text || event.text || event.content || "";
      if (text && isMeaningfulText(text)) {
        sendToTurk({ kind: "thought", content: text });
      }
      break;
    }

    case "tool_use":
    case "tool_call": {
      handleToolCall(event);
      break;
    }

    case "tool_result": {
      const toolName = event.tool || event.name || "unknown";
      const result = event.result || event.output || event.content;
      handleToolResult(toolName, result);
      break;
    }

    case "error": {
      sendToTurk({
        kind: "error",
        message: event.message || event.error || JSON.stringify(event),
      });
      break;
    }

    case "message_start":
    case "message_stop":
      // lifecycle markers, ignore
      break;

    default:
      // If it has content, show it — but only meaningful text
      if (event.content && typeof event.content === "string" && isMeaningfulText(event.content)) {
        sendToTurk({ kind: "thought", content: event.content });
      }
  }
}

function parseAssistantContent(content) {
  // Check if the content mentions tool usage, bug reports, etc.
  const lower = content.toLowerCase();

  if (lower.includes("bug") || lower.includes("error") || lower.includes("issue") || lower.includes("broken")) {
    // Try to extract a bug report from the text
    const severity = lower.includes("critical")
      ? "critical"
      : lower.includes("major")
        ? "major"
        : lower.includes("cosmetic")
          ? "cosmetic"
          : "minor";

    // Only auto-report if it looks like a structured finding
    if (
      lower.includes("steps to reproduce") ||
      lower.includes("expected") ||
      lower.includes("actual")
    ) {
      const titleMatch = content.match(/(?:bug|issue|error)[:\s]+(.+?)(?:\n|$)/i);
      sendToTurk({
        kind: "bug_report",
        severity,
        title: titleMatch ? titleMatch[1].substring(0, 100) : "Bug Found",
        description: content,
        steps: [`Step ${stepCount}`],
      });
      return;
    }
  }

  // Regular thought/reasoning
  sendToTurk({ kind: "thought", content });
}

function handleToolCall(call) {
  const name = call.name || call.function?.name || call.tool || "unknown";
  const params = call.input || call.arguments || call.params || {};

  stepCount++;

  // turk_report skill
  if (name === "turk_report" || name === "turk-reporter") {
    const reportType = params.type || "finding";
    const severity = params.severity || "minor";
    const title = params.title || "Finding";
    const description = params.description || JSON.stringify(params);

    if (reportType === "summary") {
      completionSent = true;
      sendToTurk({
        kind: "status",
        status: "completed",
        content: description,
        summary: `${title}: ${description}`,
        stepCount,
      });
    } else {
      sendToTurk({
        kind: "bug_report",
        severity,
        title,
        description,
        steps: [`Step ${stepCount}`],
      });
    }
    return;
  }

  // project_memory skill
  if (name === "project_memory" || name === "project-memory") {
    console.log(`[Bridge] Memory entry: ${params.category || "general"} — ${params.title || "Untitled"}`);
    sendToTurk({
      kind: "memory_entry",
      category: params.category || "general",
      title: params.title || "Memory Entry",
      content: params.content || JSON.stringify(params),
      sourceUrl: params.sourceUrl || params.source_url || null,
    });
    return;
  }

  // Browser tools
  if (name.includes("browser") || name.includes("navigate") || name.includes("click") || name.includes("snapshot") || name.includes("screenshot")) {
    const action = name.replace("browser.", "").replace("browser_", "");
    sendToTurk({
      kind: "action",
      action,
      params: flattenParams(params),
    });
    return;
  }

  // Other tools
  sendToTurk({
    kind: "thought",
    content: `Using tool: ${name}`,
  });
}

function handleToolResult(toolName, result) {
  // Extract base64 screenshots from various result formats
  const base64 = extractBase64(result);
  if (base64 && (toolName.includes("screenshot") || toolName.includes("snapshot") || toolName.includes("browser"))) {
    sendToTurk({ kind: "screenshot", base64 });
    return;
  }

  const resultText =
    typeof result === "string"
      ? result
      : result?.text || result?.content || JSON.stringify(result || {});

  const isError = !!(result?.error || result?.isError);
  const detail = resultText.substring(0, 500);

  // Don't send empty or noise results
  if (!detail || detail === "{}" || detail === "null") return;

  sendToTurk({
    kind: "result",
    success: !isError,
    detail,
  });
}

function extractBase64(result) {
  if (!result) return null;
  // Direct base64 field
  if (result.base64) return result.base64;
  // Nested in image field
  if (result.image?.base64) return result.image.base64;
  // Content array (OpenClaw tool result format)
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item.type === "image" && item.source?.data) return item.source.data;
      if (item.base64) return item.base64;
    }
  }
  // Content as string that looks like base64 (very long, no spaces)
  if (typeof result === "string" && result.length > 1000 && !result.includes(" ")) {
    return result;
  }
  return null;
}

function flattenParams(params) {
  const flat = {};
  for (const [key, value] of Object.entries(params || {})) {
    flat[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return flat;
}

// ─── Startup ─────────────────────────────────────────────────────────────────

console.log(`[Bridge] Turk ID: ${TURK_ID}`);
console.log(`[Bridge] Session: ${SESSION_ID}`);
console.log(`[Bridge] Turk WS: ${WS_URL}`);
console.log(`[Bridge] Gateway token: ${GATEWAY_TOKEN ? GATEWAY_TOKEN.substring(0, 8) + "..." : "none"}`);

connectToTurk();

// Send the initial prompt after a delay (let WS connect first)
setTimeout(() => {
  if (hasProjectRole) {
    console.log("[Bridge] Sending initial research prompt...");
    sendToOpenClaw(
      `Begin your research task at ${TARGET_URL}. Follow the instructions in AGENTS.md. ` +
      `Navigate to the target URL, take a snapshot to understand the page, and begin gathering data. ` +
      `Use the project_memory tool to save EVERY useful finding to the project memory bank. ` +
      `Be thorough and include full details, not just summaries. ` +
      `When you have gathered all available data, provide a final summary using turk_report with type 'summary'.`
    );
  } else {
    console.log("[Bridge] Sending initial testing prompt...");
    sendToOpenClaw(
      `Begin testing ${TARGET_URL}. Follow the methodology in AGENTS.md. ` +
      `Start by navigating to the target URL, take a snapshot to see what's on the page, ` +
      `and begin systematic testing. Report every finding using the turk_report tool.`
    );
  }
}, 5000);

// Clean shutdown
process.on("SIGTERM", () => {
  console.log("[Bridge] SIGTERM, shutting down...");
  sendToTurk({
    kind: "status",
    status: "completed",
    content: "Agent container shutting down",
    summary: `Session ended after ${stepCount} steps`,
    stepCount,
  });
  setTimeout(() => process.exit(0), 1000);
});

process.on("SIGINT", () => process.exit(0));

// Keep process alive
setInterval(() => {
  // Heartbeat — refresh token in case gateway regenerated it
  refreshToken();
}, 30000);
