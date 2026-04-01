"use client";

import { useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const errorReport = [
    "## Critical Error Report",
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
    "This is a root-level error (global-error.tsx) in a Next.js 14 app (App Router) with Prisma, PostgreSQL, and Tailwind CSS. The layout itself may have crashed.",
  ].join("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(errorReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "640px", width: "100%", textAlign: "center" }}>
          {/* Icon */}
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              backgroundColor: "#fef2f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#1e293b",
              marginBottom: "0.5rem",
            }}
          >
            Critical Error
          </h1>
          <p
            style={{
              color: "#64748b",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
            }}
          >
            {error.message || "The application encountered a fatal error"}
          </p>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              marginBottom: "1.5rem",
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#6366f1",
                color: "white",
                fontWeight: 500,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                backgroundColor: "white",
                color: "#475569",
                fontWeight: 500,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Go to Dashboard
            </button>
          </div>

          {/* Error details */}
          <div
            style={{
              textAlign: "left",
              backgroundColor: "white",
              border: "1px solid #fecaca",
              borderRadius: "0.75rem",
              padding: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Error Details
              </span>
              <button
                onClick={handleCopy}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: copied ? "#059669" : "#475569",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied!" : "Copy for LLM"}
              </button>
            </div>
            <pre
              style={{
                fontSize: "0.75rem",
                color: "#475569",
                backgroundColor: "#fef2f2",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                overflow: "auto",
                maxHeight: "256px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "monospace",
                margin: 0,
              }}
            >
              {error.stack || error.message}
            </pre>
          </div>
        </div>
      </body>
    </html>
  );
}
