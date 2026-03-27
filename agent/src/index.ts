import { BrowserManager } from "./browser";
import { OllamaClient } from "./ollama-client";
import { WSClient } from "./ws-client";
import { TaskRunner } from "./task-runner";

function decodeB64(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  return Buffer.from(val, "base64").toString("utf-8");
}

const TURK_ID = process.env.TURK_ID!;
const TARGET_URL = process.env.TARGET_URL!;
const INSTRUCTIONS = decodeB64(
  process.env.INSTRUCTIONS_B64,
  process.env.INSTRUCTIONS || ""
);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
const WS_URL = process.env.WS_URL || "ws://web:3124/api/ws";
const CREDENTIALS = JSON.parse(
  decodeB64(process.env.CREDENTIALS_B64, process.env.CREDENTIALS || "{}")
);

let browser: BrowserManager | null = null;
let ws: WSClient | null = null;

async function main() {
  if (!TURK_ID || !TARGET_URL) {
    console.error("[Turk Agent] Missing required env vars: TURK_ID, TARGET_URL");
    process.exit(1);
  }

  console.log(`[Turk Agent] Starting for turk ${TURK_ID}`);
  console.log(`[Turk Agent] Target: ${TARGET_URL}`);
  console.log(`[Turk Agent] Model: ${OLLAMA_MODEL}`);

  // Connect to web app via WebSocket
  ws = new WSClient(`${WS_URL}?turkId=${TURK_ID}&role=agent`);
  await ws.connect();
  console.log("[Turk Agent] WebSocket connected");

  // Launch browser
  browser = new BrowserManager();
  await browser.launch();
  console.log("[Turk Agent] Browser launched");

  // Initialize Ollama client
  const ollama = new OllamaClient(OLLAMA_BASE_URL, OLLAMA_MODEL);

  // Initialize task runner
  const runner = new TaskRunner(browser, ollama, ws, {
    turkId: TURK_ID,
    targetUrl: TARGET_URL,
    instructions: INSTRUCTIONS,
    credentials: CREDENTIALS,
  });

  // Handle user instructions from WebSocket
  ws.onMessage((msg) => {
    if (msg.type === "user_instruction") {
      runner.handleUserInstruction(msg.content as string);
    } else if (msg.type === "control") {
      switch (msg.action) {
        case "pause":
          runner.pause();
          break;
        case "resume":
          runner.resume();
          break;
        case "stop":
          runner.stop();
          break;
      }
    }
  });

  // Send initial status
  ws.send({
    type: "agent_update",
    turkId: TURK_ID,
    data: { kind: "status", status: "running" },
  });

  // Start the autonomous testing loop
  await runner.run();

  console.log("[Turk Agent] Testing complete, shutting down");
  await shutdown(0);
}

async function shutdown(code: number) {
  console.log("[Turk Agent] Shutting down...");
  try {
    await browser?.close();
  } catch {
    // best effort
  }
  ws?.close();
  process.exit(code);
}

// Graceful shutdown on signals
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

main().catch(async (err) => {
  console.error("[Turk Agent] Fatal error:", err);
  // Notify the web app before dying
  ws?.send({
    type: "agent_update",
    turkId: TURK_ID,
    data: { kind: "error", message: err.message || "Fatal agent error" },
  });
  await shutdown(1);
});
