const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3124", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// --- WebSocket Manager ---

// turkId -> agent socket
const agentSockets = new Map();
// turkId -> Set<browser socket>
const browserSockets = new Map();
// turkId -> { runId, stepCount, completedNormally }
const activeRuns = new Map();

function broadcastToBrowsers(turkId, msg) {
  const sockets = browserSockets.get(turkId);
  if (!sockets) return;
  const payload = typeof msg === "string" ? msg : JSON.stringify(msg);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Find or create the active TaskRun for a turk
async function getActiveRunId(turkId) {
  const existing = activeRuns.get(turkId);
  if (existing) return existing.runId;

  // Look for a running TaskRun in the DB
  const run = await prisma.taskRun.findFirst({
    where: { turkId, status: "running" },
    orderBy: { startedAt: "desc" },
  });

  if (run) {
    activeRuns.set(turkId, {
      runId: run.id,
      stepCount: 0,
      completedNormally: false,
    });
    return run.id;
  }

  return null;
}

async function handleMessage(msg, senderRole, turkId) {
  try {
    if (senderRole === "browser") {
      if (msg.type === "user_instruction" || msg.type === "control") {
        const agentWs = agentSockets.get(turkId);
        if (agentWs && agentWs.readyState === WebSocket.OPEN) {
          agentWs.send(JSON.stringify(msg));
        }
        if (msg.type === "user_instruction" && msg.content) {
          await prisma.message.create({
            data: { turkId, role: "user", content: String(msg.content) },
          });
        }
      }
    } else if (senderRole === "agent" && msg.type === "agent_update") {
      broadcastToBrowsers(turkId, msg);

      const data = msg.data || {};
      let content = "";
      switch (data.kind) {
        case "thought":
          content = `Thinking: ${data.content}`;
          break;
        case "action":
          content = `Action: ${data.action}`;
          break;
        case "result":
          content = `Result: ${data.detail}`;
          break;
        case "bug_report":
          content = `BUG [${data.severity}]: ${data.title} - ${data.description}`;
          break;
        case "error":
          content = `Error: ${data.message || data.content}`;
          break;
        case "memory_entry":
          content = `[Memory: ${data.category}] ${data.title}`;
          break;
        case "screenshot":
          content = "Captured screenshot";
          break;
        case "status":
          content = `Status: ${data.status || data.content}`;
          break;
        default:
          content = JSON.stringify(data);
      }

      // Save message
      await prisma.message.create({
        data: {
          turkId,
          role: "agent",
          content,
          metadata: data,
        },
      });

      // --- Create MemoryEntry if this is a memory_entry message ---
      if (data.kind === "memory_entry") {
        try {
          const turk = await prisma.turk.findUnique({
            where: { id: turkId },
            select: { projectId: true },
          });
          if (turk?.projectId) {
            await prisma.memoryEntry.create({
              data: {
                projectId: turk.projectId,
                turkId: turkId,
                category: data.category || "general",
                title: data.title || "Untitled",
                content: data.content || "",
                sourceUrl: data.sourceUrl || null,
              },
            });
          }
        } catch (err) {
          console.error("[WS] Error creating memory entry:", err.message);
        }
      }

      // --- Create TaskStep for trackable actions ---
      const runId = await getActiveRunId(turkId);
      if (runId) {
        if (data.kind === "action") {
          const runInfo = activeRuns.get(turkId);
          if (runInfo) runInfo.stepCount++;

          await prisma.taskStep.create({
            data: {
              runId,
              action: data.action || "unknown",
              target: data.params
                ? JSON.stringify(data.params)
                : null,
              result: null,
            },
          });

          // Broadcast updated step count
          broadcastToBrowsers(turkId, {
            type: "step_count",
            turkId,
            count: runInfo ? runInfo.stepCount : 1,
          });
        }

        if (data.kind === "result") {
          // Update the most recent step with its result
          const lastStep = await prisma.taskStep.findFirst({
            where: { runId },
            orderBy: { createdAt: "desc" },
          });
          if (lastStep) {
            await prisma.taskStep.update({
              where: { id: lastStep.id },
              data: {
                result: `${data.success ? "✓" : "✗"} ${data.detail}`,
              },
            });
          }
        }

        if (data.kind === "screenshot") {
          // Attach screenshot to the most recent step
          const lastStep = await prisma.taskStep.findFirst({
            where: { runId },
            orderBy: { createdAt: "desc" },
          });
          if (lastStep) {
            await prisma.taskStep.update({
              where: { id: lastStep.id },
              data: { screenshot: data.base64 ? "captured" : null },
            });
          }
        }

        if (data.kind === "bug_report") {
          await prisma.taskStep.create({
            data: {
              runId,
              action: "bug_report",
              target: `[${data.severity}] ${data.title}`,
              result: data.description,
            },
          });
          const runInfo = activeRuns.get(turkId);
          if (runInfo) runInfo.stepCount++;
        }
      }

      // --- Handle status changes ---
      if (data.kind === "status" && data.status) {
        if (data.status === "completed") {
          // Mark the TaskRun as completed
          if (runId) {
            const summary =
              data.content || data.summary || "Testing session completed";
            await prisma.taskRun.update({
              where: { id: runId },
              data: {
                status: "completed",
                summary,
                completedAt: new Date(),
              },
            });
            const runInfo = activeRuns.get(turkId);
            if (runInfo) runInfo.completedNormally = true;
          }

          await prisma.turk
            .update({
              where: { id: turkId },
              data: { status: "stopped" },
            })
            .catch(() => {});

          // Two-phase auto-start: when all producers finish, start consumers
          try {
            const turkRecord = await prisma.turk.findUnique({
              where: { id: turkId },
              select: { projectId: true, metadata: true },
            });
            if (turkRecord?.projectId) {
              const projectTurks = await prisma.turk.findMany({
                where: { projectId: turkRecord.projectId },
                select: { id: true, status: true, metadata: true },
              });

              const isConsumer = (meta) =>
                meta && typeof meta === "object" && Array.isArray(meta.memoryInputCategories) && meta.memoryInputCategories.length > 0;

              const producers = projectTurks.filter((t) => !isConsumer(t.metadata));
              const consumers = projectTurks.filter((t) => isConsumer(t.metadata));

              const completedTurkIsProducer = !isConsumer(turkRecord.metadata);
              const activeProducers = producers.filter((t) =>
                ["running", "starting", "paused"].includes(t.status)
              );

              // If a producer just finished and no producers remain active, start consumers
              if (completedTurkIsProducer && activeProducers.length === 0 && consumers.length > 0) {
                const stoppedConsumers = consumers.filter((t) => t.status === "stopped");
                for (const consumer of stoppedConsumers) {
                  try {
                    console.log(`[WS] Auto-starting consumer turk ${consumer.id}`);
                    broadcastToBrowsers(consumer.id, {
                      type: "agent_update",
                      turkId: consumer.id,
                      data: { kind: "status", status: "starting" },
                    });
                    const startRes = await fetch(`http://localhost:${port}/api/turks/${consumer.id}/start`, {
                      method: "POST",
                    });
                    if (!startRes.ok) {
                      console.error(`[WS] Failed to auto-start consumer ${consumer.id}: ${startRes.status}`);
                    }
                    // Small delay between starts to avoid overwhelming Docker
                    await new Promise((r) => setTimeout(r, 1000));
                  } catch (startErr) {
                    console.error(`[WS] Error auto-starting consumer ${consumer.id}:`, startErr.message);
                  }
                }
              }

              // Auto-complete project when ALL turks (producers + consumers) are done
              const allActive = projectTurks.filter((t) =>
                ["running", "starting", "paused"].includes(t.status)
              );
              if (allActive.length === 0) {
                await prisma.project.updateMany({
                  where: { id: turkRecord.projectId, status: "in_progress" },
                  data: { status: "completed" },
                });
              }
            }
          } catch (err) {
            console.error("[WS] Error in turk completion handler:", err.message);
          }

          activeRuns.delete(turkId);
        } else {
          // Update turk status for other statuses (running, paused, etc.)
          await prisma.turk
            .update({
              where: { id: turkId },
              data: { status: data.status },
            })
            .catch(() => {});
        }
      }

      // Handle "done" action from the thought/action cycle
      if (data.kind === "thought" && data.content) {
        // If this is the final summary thought before "done", capture it
        const runInfo = activeRuns.get(turkId);
        if (runInfo) {
          runInfo.lastThought = data.content;
        }
      }
    }
  } catch (err) {
    console.error("[WS] Error handling message:", err.message);
  }
}

function registerSocket(ws, turkId, role) {
  if (role === "agent") {
    agentSockets.set(turkId, ws);
    broadcastToBrowsers(turkId, {
      type: "agent_update",
      turkId,
      data: { kind: "status", status: "running" },
    });
    console.log(`[WS] Agent connected for turk ${turkId}`);
  } else {
    if (!browserSockets.has(turkId)) {
      browserSockets.set(turkId, new Set());
    }
    browserSockets.get(turkId).add(ws);
    console.log(`[WS] Browser connected for turk ${turkId}`);
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(msg, role, turkId);
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", async () => {
    if (role === "agent") {
      if (agentSockets.get(turkId) === ws) {
        agentSockets.delete(turkId);

        const runInfo = activeRuns.get(turkId);
        const completedNormally = runInfo?.completedNormally;

        if (completedNormally) {
          // Agent disconnected after normal completion — already handled
          console.log(
            `[WS] Agent disconnected normally for turk ${turkId}`
          );
        } else {
          // Check if turk was stopped by user (status already "stopped")
          const currentTurk = await prisma.turk
            .findUnique({ where: { id: turkId } })
            .catch(() => null);

          if (currentTurk && currentTurk.status === "stopped") {
            // User-initiated stop — don't override with error
            console.log(
              `[WS] Agent disconnected after user stop for turk ${turkId}`
            );
          } else {
            // Agent disconnected unexpectedly
            broadcastToBrowsers(turkId, {
              type: "agent_update",
              turkId,
              data: { kind: "status", status: "error" },
            });

            // Mark turk as errored
            await prisma.turk
              .update({ where: { id: turkId }, data: { status: "error" } })
              .catch(() => {});

            // Mark any still-running TaskRun as failed
            const runId = runInfo?.runId;
            if (runId) {
              const run = await prisma.taskRun
                .findUnique({ where: { id: runId } })
                .catch(() => null);
              if (run && run.status === "running") {
                await prisma.taskRun
                  .update({
                    where: { id: runId },
                    data: {
                      status: "failed",
                      summary: `Agent disconnected unexpectedly after ${runInfo?.stepCount || 0} steps`,
                      completedAt: new Date(),
                    },
                  })
                  .catch(() => {});
              }
            }

            console.log(
              `[WS] Agent disconnected unexpectedly for turk ${turkId}`
            );
          }
        }

        activeRuns.delete(turkId);
      }
    } else {
      browserSockets.get(turkId)?.delete(ws);
      console.log(`[WS] Browser disconnected for turk ${turkId}`);
    }
  });

  ws.on("error", (err) => {
    console.error(`[WS] Socket error (${role}/${turkId}):`, err.message);
  });
}

// --- Start Server ---

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const { pathname, searchParams } = new URL(
        request.url,
        `http://${request.headers.host}`
      );

      if (pathname === "/api/ws") {
        const turkId = searchParams.get("turkId");
        const role = searchParams.get("role");

        if (!turkId || !["agent", "browser"].includes(role)) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          registerSocket(ws, turkId, role);
        });
      }
      // Let Next.js HMR and other upgrade requests pass through
    } catch (err) {
      console.error("[WS] Upgrade error:", err.message);
      socket.destroy();
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Turk running on http://${hostname}:${port}`);
  });
});
