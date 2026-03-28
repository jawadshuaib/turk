"use client";

import { useState } from "react";
import { EnhanceInstructions } from "./enhance-instructions";

export function TurkInstructions({
  turkId,
  initialInstructions,
  targetUrl,
}: {
  turkId: string;
  initialInstructions: string;
  targetUrl: string;
}) {
  const [instructions, setInstructions] = useState(initialInstructions);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(newInstructions: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/turks/${turkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: newInstructions }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setInstructions(newInstructions);
      setEditing(false);
    } catch {
      alert("Failed to save instructions");
    } finally {
      setSaving(false);
    }
  }

  function handleEnhanced(enhanced: string) {
    setInstructions(enhanced);
    setEditing(true);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-500">Instructions</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            className="textarea w-full h-32 text-sm"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <div className="flex items-center justify-between mt-2">
            <EnhanceInstructions
              instructions={instructions}
              targetUrl={targetUrl}
              onEnhanced={handleEnhanced}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInstructions(initialInstructions);
                  setEditing(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => save(instructions)}
                disabled={saving}
                className="btn-primary text-xs !py-1 !px-3"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-slate-700 text-sm whitespace-pre-wrap">
            {instructions}
          </p>
          <EnhanceInstructions
            instructions={instructions}
            targetUrl={targetUrl}
            onEnhanced={handleEnhanced}
          />
        </div>
      )}
    </div>
  );
}
