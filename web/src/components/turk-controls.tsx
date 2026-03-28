"use client";

import { useState, useEffect, useRef } from "react";

export function TurkControls({
  turkId,
  status: initialStatus,
}: {
  turkId: string;
  status: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Listen for live status updates via WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/ws?turkId=${turkId}&role=browser`
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "agent_update" && data.data?.kind === "status") {
          const newStatus = data.data.status;
          if (newStatus === "completed") {
            setStatus("stopped");
          } else if (newStatus) {
            setStatus(newStatus);
          }
        }
      } catch {
        // ignore
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [turkId]);

  async function handleAction(action: "start" | "stop" | "pause" | "resume") {
    setLoading(action);
    try {
      // For pause/resume, also send the WS control message
      if ((action === "pause" || action === "resume") && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "control", turkId, action })
        );
      }

      const res = await fetch(`/api/turks/${turkId}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action}`);
      }

      // Optimistic status update
      switch (action) {
        case "start":
          setStatus("running");
          break;
        case "stop":
          setStatus("stopped");
          break;
        case "pause":
          setStatus("paused");
          break;
        case "resume":
          setStatus("running");
          break;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this turk?")) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/turks/${turkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      window.location.href = "/turks";
    } catch {
      alert("Failed to delete turk");
    } finally {
      setLoading(null);
    }
  }

  const statusColors: Record<string, string> = {
    running: "bg-emerald-50 text-emerald-600",
    paused: "bg-amber-50 text-amber-600",
    stopped: "bg-slate-100 text-slate-500",
    error: "bg-red-50 text-red-600",
    starting: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="flex items-center gap-3">
      {/* Status badge */}
      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          statusColors[status] || "bg-slate-100 text-slate-500"
        }`}
      >
        {status === "running" && (
          <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
        )}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>

      {/* Action buttons */}
      {(status === "stopped" || status === "error") && (
        <button
          className="btn-primary"
          onClick={() => handleAction("start")}
          disabled={loading !== null}
        >
          {loading === "start" ? (
            <span className="flex items-center gap-2">
              <Spinner /> Starting...
            </span>
          ) : (
            "▶ Start"
          )}
        </button>
      )}

      {status === "running" && (
        <>
          <button
            className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            onClick={() => handleAction("pause")}
            disabled={loading !== null}
          >
            {loading === "pause" ? (
              <span className="flex items-center gap-2">
                <Spinner /> Pausing...
              </span>
            ) : (
              "⏸ Pause"
            )}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleAction("stop")}
            disabled={loading !== null}
          >
            {loading === "stop" ? "Stopping..." : "⏹ Stop"}
          </button>
        </>
      )}

      {status === "paused" && (
        <>
          <button
            className="btn-primary"
            onClick={() => handleAction("resume")}
            disabled={loading !== null}
          >
            {loading === "resume" ? (
              <span className="flex items-center gap-2">
                <Spinner /> Resuming...
              </span>
            ) : (
              "▶ Resume"
            )}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleAction("stop")}
            disabled={loading !== null}
          >
            {loading === "stop" ? "Stopping..." : "⏹ Stop"}
          </button>
        </>
      )}

      {status === "starting" && (
        <button className="btn-secondary" disabled>
          <span className="flex items-center gap-2">
            <Spinner /> Starting...
          </span>
        </button>
      )}

      <button
        className="btn-danger text-sm py-1.5 px-3"
        onClick={handleDelete}
        disabled={loading !== null || status === "running"}
        title={status === "running" ? "Stop the turk before deleting" : "Delete turk"}
      >
        {loading === "delete" ? "..." : "🗑"}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
