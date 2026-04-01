"use client";

import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("[Turk Error Boundary]", error);
  }, [error]);

  const errorReport = [
    "## Error Report",
    "",
    `**Message:** ${error.message}`,
    "",
    `**Digest:** ${error.digest || "N/A"}`,
    "",
    `**URL:** ${typeof window !== "undefined" ? window.location.href : "unknown"}`,
    "",
    `**Time:** ${new Date().toISOString()}`,
    "",
    "**Stack Trace:**",
    "```",
    error.stack || "No stack trace available",
    "```",
    "",
    "---",
    "Please help me fix this error. The project is a Next.js 14 app (App Router) with Prisma, PostgreSQL, and Tailwind CSS.",
  ].join("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(errorReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = errorReport;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Something went wrong
          </h1>
          <p className="text-slate-500 text-sm">
            {error.message || "An unexpected error occurred"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button onClick={reset} className="btn-primary">
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="btn-secondary"
          >
            Go to Dashboard
          </button>
        </div>

        {/* Error details — copyable for LLM */}
        <div className="card border-red-200 bg-red-50/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Error Details
            </h2>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-colors"
            >
              {copied ? (
                <>
                  <svg
                    className="w-3.5 h-3.5 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                  Copy for LLM
                </>
              )}
            </button>
          </div>

          <pre className="text-xs text-slate-600 bg-white rounded-lg border border-red-100 p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono">
            {error.stack || error.message}
          </pre>

          {error.digest && (
            <p className="text-[11px] text-slate-400 mt-2">
              Digest: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
