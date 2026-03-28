"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Message = {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Finding = {
  id: string;
  severity: string;
  title: string;
  description: string;
  step: string;
  createdAt: string;
};

export function TurkChat({
  turkId,
  initialMessages,
}: {
  turkId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>("idle");
  const [stepCount, setStepCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"activity" | "findings">(
    "activity"
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const stepCountRef = useRef(0);

  // Extract findings from initial messages
  useEffect(() => {
    const initialFindings: Finding[] = initialMessages
      .filter(
        (m) =>
          m.metadata &&
          ((m.metadata as Record<string, unknown>).kind === "bug_report" ||
            ((m.metadata as Record<string, unknown>).kind === "result" &&
              (m.metadata as Record<string, unknown>).success === false))
      )
      .map((m) => {
        const meta = m.metadata as Record<string, unknown>;
        if (meta.kind === "bug_report") {
          return {
            id: m.id,
            severity: (meta.severity as string) || "minor",
            title: (meta.title as string) || "Bug found",
            description: (meta.description as string) || m.content,
            step: Array.isArray(meta.steps)
              ? (meta.steps as string[]).join(" -> ")
              : "unknown",
            createdAt: m.createdAt,
          };
        }
        return {
          id: m.id,
          severity: "info",
          title: "Failed assertion",
          description: (meta.detail as string) || m.content,
          step: "unknown",
          createdAt: m.createdAt,
        };
      });
    setFindings(initialFindings);
  }, [initialMessages]);

  const connectWS = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/ws?turkId=${turkId}&role=browser`
    );

    ws.onopen = () => {
      setConnected(true);
      console.log("[TurkChat] WebSocket connected");
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectRef.current = setTimeout(() => {
        console.log("[TurkChat] Reconnecting...");
        connectWS();
      }, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "agent_update") {
          const meta = data.data || {};

          // Update agent status
          if (meta.kind === "status") {
            setAgentStatus(meta.status || meta.content || "unknown");
          }

          // Create chat message
          const msg: Message = {
            id: crypto.randomUUID(),
            role: "agent",
            content: formatAgentUpdate(meta),
            metadata: meta,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, msg]);

          // Track findings
          if (meta.kind === "bug_report") {
            const finding: Finding = {
              id: msg.id,
              severity: (meta.severity as string) || "minor",
              title: (meta.title as string) || "Bug found",
              description: (meta.description as string) || "",
              step: Array.isArray(meta.steps)
                ? (meta.steps as string[]).join(" -> ")
                : `Step ${stepCountRef.current}`,
              createdAt: msg.createdAt,
            };
            setFindings((prev) => [...prev, finding]);
          }

          if (
            meta.kind === "result" &&
            meta.success === false
          ) {
            const finding: Finding = {
              id: msg.id,
              severity: "info",
              title: "Action failed",
              description: (meta.detail as string) || "",
              step: `Step ${stepCount}`,
              createdAt: msg.createdAt,
            };
            setFindings((prev) => [...prev, finding]);
          }
        }

        if (data.type === "step_count") {
          setStepCount(data.count);
          stepCountRef.current = data.count;
        }
      } catch {
        // ignore malformed messages
      }
    };

    wsRef.current = ws;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turkId]);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  // Poll for new messages as a fallback (and to catch messages persisted by the server)
  const lastMessageTimeRef = useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : new Date(0).toISOString()
  );

  useEffect(() => {
    // Update the ref whenever messages change
    if (messages.length > 0) {
      lastMessageTimeRef.current = messages[messages.length - 1].createdAt;
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/turks/${turkId}/messages?after=${encodeURIComponent(lastMessageTimeRef.current)}`
        );
        if (!res.ok) return;
        const newMsgs: Message[] = await res.json();
        if (newMsgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const unique = newMsgs.filter((m) => !existingIds.has(m.id));
            if (unique.length === 0) return prev;
            return [...prev, ...unique];
          });

          // Update findings from polled messages
          for (const m of newMsgs) {
            if (!m.metadata) continue;
            const meta = m.metadata as Record<string, unknown>;
            if (meta.kind === "bug_report") {
              setFindings((prev) => {
                if (prev.some((f) => f.id === m.id)) return prev;
                return [
                  ...prev,
                  {
                    id: m.id,
                    severity: (meta.severity as string) || "minor",
                    title: (meta.title as string) || "Bug found",
                    description: (meta.description as string) || m.content,
                    step: Array.isArray(meta.steps)
                      ? (meta.steps as string[]).join(" -> ")
                      : "unknown",
                    createdAt: m.createdAt,
                  },
                ];
              });
            }
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [turkId]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll
  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;

    const msg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);

    wsRef.current.send(
      JSON.stringify({
        type: "user_instruction",
        turkId,
        content: input,
      })
    );

    setInput("");
    setAutoScroll(true);
  }

  const bugCount = findings.filter((f) => f.severity !== "info").length;
  const failCount = findings.filter((f) => f.severity === "info").length;

  return (
    <div className="card flex flex-col flex-1 min-h-0">
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button
            className={`text-sm font-medium px-3 py-1 rounded-md transition-colors ${
              activeTab === "activity"
                ? "bg-turk-50 text-turk-700"
                : "text-slate-400 hover:text-slate-600"
            }`}
            onClick={() => setActiveTab("activity")}
          >
            Activity
            {stepCount > 0 && (
              <span className="ml-1.5 text-xs text-slate-400">
                ({stepCount})
              </span>
            )}
          </button>
          <button
            className={`text-sm font-medium px-3 py-1 rounded-md transition-colors ${
              activeTab === "findings"
                ? "bg-turk-50 text-turk-700"
                : "text-slate-400 hover:text-slate-600"
            }`}
            onClick={() => setActiveTab("findings")}
          >
            Findings
            {findings.length > 0 && (
              <span className="ml-1.5 text-xs">
                {bugCount > 0 && (
                  <span className="text-red-500">{bugCount} bugs</span>
                )}
                {bugCount > 0 && failCount > 0 && (
                  <span className="text-slate-300"> / </span>
                )}
                {failCount > 0 && (
                  <span className="text-amber-500">{failCount} failures</span>
                )}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {agentStatus === "running" && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Step {stepCount}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              connected
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {connected ? "Live" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-[300px] max-h-[600px] scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <p className="text-3xl mb-3">🤖</p>
                <p>No activity yet. Start the turk to begin testing.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessage key={msg.id} msg={msg} />
              ))
            )}

            {/* Scroll anchor indicator */}
            {!autoScroll && messages.length > 0 && (
              <button
                className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-turk-600 text-white text-xs px-3 py-1 rounded-full shadow-lg z-10"
                onClick={() => {
                  setAutoScroll(true);
                  scrollRef.current?.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }}
              >
                ↓ New messages
              </button>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Send instructions to the turk..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!connected}
            >
              Send
            </button>
          </form>
        </>
      )}

      {/* Findings Tab */}
      {activeTab === "findings" && (
        <FindingsPanel turkId={turkId} findings={findings} />
      )}
    </div>
  );
}

// --- Chat Message Component ---

function ChatMessage({ msg }: { msg: Message }) {
  const meta = msg.metadata as Record<string, unknown> | null;
  const kind = meta?.kind as string | undefined;

  // Compact display for thoughts (collapsible)
  if (kind === "thought") {
    return <ThoughtMessage content={msg.content} time={msg.createdAt} />;
  }

  // Bug report - prominent display
  if (kind === "bug_report") {
    return (
      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-red-600 text-xs font-bold uppercase">
            🐛 Bug [{meta?.severity as string}]
          </span>
          <span className="text-slate-400 text-xs">
            {new Date(msg.createdAt).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-red-800 text-sm font-medium">
          {meta?.title as string}
        </p>
        <p className="text-red-600 text-xs mt-1">
          {meta?.description as string}
        </p>
      </div>
    );
  }

  // Action - compact inline
  if (kind === "action") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-turk-500 text-xs font-mono">→</span>
        <span className="text-slate-600 text-sm">
          <span className="text-turk-600 font-medium">
            {meta?.action as string}
          </span>
          <span className="text-slate-400 ml-1 text-xs">
            {meta?.params
              ? formatParams(meta.params as Record<string, string>)
              : ""}
          </span>
        </span>
        <span className="text-slate-300 text-xs ml-auto">
          {new Date(msg.createdAt).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  // Result - compact inline
  if (kind === "result") {
    const success = meta?.success as boolean;
    return (
      <div className="flex items-center gap-2 px-3 py-1">
        <span
          className={`text-xs ${success ? "text-emerald-500" : "text-red-500"}`}
        >
          {success ? "✓" : "✗"}
        </span>
        <span
          className={`text-xs ${success ? "text-emerald-600" : "text-red-600"}`}
        >
          {meta?.detail as string}
        </span>
      </div>
    );
  }

  // Screenshot
  if (kind === "screenshot") {
    return (
      <div className="px-3 py-2">
        <p className="text-slate-400 text-xs mb-1">📸 Screenshot captured</p>
        {typeof meta?.base64 === "string" && (
          <img
            src={`data:image/png;base64,${meta.base64}`}
            alt="Screenshot"
            className="rounded border border-slate-200 max-w-full max-h-[300px]"
          />
        )}
      </div>
    );
  }

  // Error
  if (kind === "error") {
    return (
      <div className="border border-red-200 rounded px-3 py-2 bg-red-50">
        <span className="text-red-600 text-xs font-medium">⚠ Error: </span>
        <span className="text-red-500 text-xs">
          {(meta?.message as string) || (meta?.content as string) || msg.content}
        </span>
      </div>
    );
  }

  // Status change
  if (kind === "status") {
    return (
      <div className="text-center py-1">
        <span className="text-slate-400 text-xs bg-slate-100 px-3 py-0.5 rounded-full">
          Status: {(meta?.status as string) || (meta?.content as string)}
        </span>
      </div>
    );
  }

  // User message
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg px-4 py-2 bg-turk-600 text-white text-sm">
          <p className="whitespace-pre-wrap">{msg.content}</p>
          <p className="text-xs text-turk-200/60 mt-1">
            {new Date(msg.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }

  // Default agent message
  return (
    <div className="px-3 py-1">
      <span className="text-slate-500 text-sm">{msg.content}</span>
      <span className="text-slate-300 text-xs ml-2">
        {new Date(msg.createdAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

// --- Thought Message (collapsible) ---

function ThoughtMessage({
  content,
  time,
}: {
  content: string;
  time: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = content.replace(/^Thinking:\s*/i, "");

  // Short thoughts show inline, long ones are collapsible
  if (text.length < 80) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-slate-400">
        <span className="text-xs">💭</span>
        <span className="text-xs italic">{text}</span>
        <span className="text-slate-300 text-xs ml-auto">
          {new Date(time).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  return (
    <div className="px-3 py-1">
      <button
        className="flex items-center gap-2 text-slate-400 hover:text-slate-500 transition-colors w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs">💭</span>
        <span className="text-xs italic truncate flex-1">
          {expanded ? text : text.slice(0, 70) + "..."}
        </span>
        <span className="text-slate-300 text-xs">
          {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded && (
        <p className="text-slate-400 text-xs italic mt-1 ml-6 whitespace-pre-wrap">
          {text}
        </p>
      )}
    </div>
  );
}

// --- Findings Panel ---

function FindingsPanel({
  turkId,
  findings,
}: {
  turkId: string;
  findings: Finding[];
}) {
  const [copied, setCopied] = useState(false);

  const severityOrder: Record<string, number> = {
    critical: 0,
    major: 1,
    minor: 2,
    cosmetic: 3,
    info: 4,
  };

  const sorted = [...findings].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
  );

  function copyForLLM() {
    const text = sorted
      .map(
        (f, i) =>
          `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n   ${f.description}\n   Found at: ${f.step}`
      )
      .join("\n\n");

    const prompt = `The following bugs and issues were found during automated testing of a web application. Please analyze each finding and suggest fixes:\n\n${text}`;

    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function exportFindings() {
    const text = sorted
      .map(
        (f, i) =>
          `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n   Description: ${f.description}\n   Found at: ${f.step}\n   Time: ${new Date(f.createdAt).toLocaleString()}`
      )
      .join("\n\n");

    const blob = new Blob(
      [
        `# Turk Testing Findings\n# Generated: ${new Date().toLocaleString()}\n# Turk ID: ${turkId}\n\n${text}`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turk-findings-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (findings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 py-12">
        <div className="text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p>No findings yet.</p>
          <p className="text-xs mt-1">
            Bugs and failures will appear here as they&apos;re discovered.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[600px]">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 text-xs">
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded transition-colors"
            onClick={exportFindings}
          >
            ↓ Export
          </button>
          <button
            className="text-xs bg-turk-600 hover:bg-turk-700 text-white px-2.5 py-1 rounded transition-colors"
            onClick={copyForLLM}
          >
            {copied ? "✓ Copied!" : "📋 Copy for Claude Code"}
          </button>
        </div>
      </div>

      {/* Findings list */}
      <div className="space-y-2">
        {sorted.map((f) => (
          <FindingCard key={f.id} finding={f} />
        ))}
      </div>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);

  const severityColors: Record<string, string> = {
    critical: "border-red-300 bg-red-50",
    major: "border-red-200 bg-red-50/50",
    minor: "border-amber-200 bg-amber-50/50",
    cosmetic: "border-slate-200 bg-slate-50",
    info: "border-blue-200 bg-blue-50/50",
  };

  const severityBadge: Record<string, string> = {
    critical: "bg-red-600 text-white",
    major: "bg-red-100 text-red-700",
    minor: "bg-amber-100 text-amber-700",
    cosmetic: "bg-slate-200 text-slate-600",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
        severityColors[finding.severity] || severityColors.info
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
            severityBadge[finding.severity] || severityBadge.info
          }`}
        >
          {finding.severity}
        </span>
        <span className="text-sm text-slate-700 flex-1 truncate">
          {finding.title}
        </span>
        <span className="text-slate-300 text-xs">
          {expanded ? "▼" : "▶"}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 pl-2 border-l-2 border-slate-200 ml-1">
          <p className="text-slate-500 text-xs whitespace-pre-wrap">
            {finding.description}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Found at: {finding.step} &middot;{" "}
            {new Date(finding.createdAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function formatAgentUpdate(data: Record<string, unknown>): string {
  switch (data.kind) {
    case "thought":
      return `Thinking: ${data.content}`;
    case "action":
      return `${data.action}(${formatParams(data.params as Record<string, string>)})`;
    case "result":
      return `${data.success ? "OK" : "FAIL"}: ${data.detail}`;
    case "screenshot":
      return "Captured screenshot";
    case "error":
      return `Error: ${data.message || data.content}`;
    case "status":
      return `Status: ${data.status || data.content}`;
    case "bug_report":
      return `BUG [${data.severity}]: ${data.title}\n${data.description}`;
    default:
      return JSON.stringify(data);
  }
}

function formatParams(params: Record<string, string> | undefined): string {
  if (!params) return "";
  const entries = Object.entries(params);
  if (entries.length === 0) return "";
  if (entries.length === 1) return entries[0][1];
  return entries.map(([k, v]) => `${k}="${v}"`).join(", ");
}
