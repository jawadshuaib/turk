"use client";

import { useState } from "react";

export function EnhanceInstructions({
  instructions,
  targetUrl,
  onEnhanced,
}: {
  instructions: string;
  targetUrl?: string;
  onEnhanced: (enhanced: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  if (!instructions.trim()) return null;

  async function handleEnhance() {
    setLoading(true);
    try {
      const res = await fetch("/api/enhance-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions, targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to enhance");
      }
      if (data.enhanced) {
        onEnhanced(data.enhanced);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to enhance instructions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleEnhance}
      disabled={loading}
      className="text-turk-400 hover:text-turk-300 text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait mt-1.5"
    >
      {loading ? (
        <>
          <Spinner />
          Enhancing...
        </>
      ) : (
        <>
          <WandIcon />
          Enhance with AI
        </>
      )}
    </button>
  );
}

function WandIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
