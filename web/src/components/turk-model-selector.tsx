"use client";

import { useState, useEffect, useCallback } from "react";

export function TurkModelSelector({
  turkId,
  initialModel,
  initialSource,
}: {
  turkId: string;
  initialModel: string;
  initialSource: string;
}) {
  const [model, setModel] = useState(initialModel);
  const [source, setSource] = useState<"local" | "cloud">(
    initialSource === "cloud" ? "cloud" : "local"
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editSource, setEditSource] = useState(source);
  const [editModel, setEditModel] = useState(model);
  const [useCustom, setUseCustom] = useState(false);
  const [customModel, setCustomModel] = useState("");

  // Model lists
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [cloudModels, setCloudModels] = useState<string[]>([]);
  const [hasCloudKey, setHasCloudKey] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const [localRes, cloudRes, keyRes] = await Promise.all([
        fetch("/api/ollama/models").then((r) => r.json()).catch(() => []),
        fetch("/api/ollama/cloud-models").then((r) => r.json()).catch(() => ({})),
        fetch("/api/settings?key=OLLAMA_API_KEY").then((r) => r.json()).catch(() => ({})),
      ]);

      if (Array.isArray(localRes)) {
        setLocalModels(localRes.map((m: { name: string }) => m.name));
      }
      if (cloudRes.models && Array.isArray(cloudRes.models)) {
        setCloudModels(cloudRes.models.map((m: { name: string }) => m.name));
      }
      setHasCloudKey(!!keyRes.hasValue);
    } catch {
      // ignore
    } finally {
      setLoadingModels(false);
    }
  }, []);

  function startEditing() {
    setEditSource(source);
    setEditModel(model);
    setUseCustom(false);
    setCustomModel("");
    setEditing(true);
    fetchModels();
  }

  function handleSourceChange(newSource: "local" | "cloud") {
    setEditSource(newSource);
    setUseCustom(false);
    setCustomModel("");
    const list = newSource === "local" ? localModels : cloudModels;
    if (list.length > 0) {
      setEditModel(list.includes(editModel) ? editModel : list[0]);
    } else {
      setEditModel("");
    }
  }

  async function save() {
    const finalModel = useCustom ? customModel.trim() : editModel;
    if (!finalModel) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/turks/${turkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollamaModel: finalModel, modelSource: editSource }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setModel(finalModel);
      setSource(editSource);
      setEditing(false);

      // Save as default for future turks
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "DEFAULT_OLLAMA_MODEL", value: finalModel }),
      }).catch(() => {});
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "DEFAULT_MODEL_SOURCE", value: editSource }),
      }).catch(() => {});
    } catch {
      alert("Failed to update model");
    } finally {
      setSaving(false);
    }
  }

  const currentList = editSource === "local" ? localModels : cloudModels;

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-slate-500 text-sm flex-shrink-0">Model:</span>
          {model ? (
            <>
              <span className="text-slate-700 text-sm truncate">{model}</span>
              <span
                className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  source === "cloud"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {source === "cloud" ? "cloud" : "local"}
              </span>
            </>
          ) : (
            <span className="text-amber-500 text-sm">Not configured</span>
          )}
        </div>
        <button
          onClick={startEditing}
          className="text-slate-400 hover:text-slate-600 text-xs flex-shrink-0 ml-2"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-sm">Model</span>
        <button
          onClick={() => setEditing(false)}
          className="text-slate-400 hover:text-slate-600 text-xs"
        >
          Cancel
        </button>
      </div>

      {/* Source toggle */}
      <div className="flex bg-slate-100 rounded-lg p-0.5">
        <button
          onClick={() => handleSourceChange("local")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            editSource === "local"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Local Ollama
        </button>
        <button
          onClick={() => handleSourceChange("cloud")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            editSource === "cloud"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Ollama Cloud
        </button>
      </div>

      {/* Cloud key warning */}
      {editSource === "cloud" && !hasCloudKey && !loadingModels && (
        <p className="text-amber-600 text-xs">
          No API key set. Add one in{" "}
          <a href="/settings" className="underline hover:text-amber-700">Settings</a>.
        </p>
      )}

      {/* Model dropdown or custom input */}
      {loadingModels ? (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
          <div className="w-3 h-3 border-2 border-slate-300 border-t-turk-500 rounded-full animate-spin" />
          Loading models...
        </div>
      ) : useCustom ? (
        <div>
          <input
            type="text"
            className="input w-full text-sm"
            placeholder="e.g., qwen3:14b"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            autoFocus
          />
          <button
            onClick={() => {
              setUseCustom(false);
              setCustomModel("");
            }}
            className="text-slate-400 hover:text-slate-600 text-xs mt-1"
          >
            Back to list
          </button>
        </div>
      ) : (
        <div>
          {currentList.length > 0 ? (
            <select
              className="input w-full text-sm"
              value={editModel}
              onChange={(e) => setEditModel(e.target.value)}
            >
              {currentList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-slate-400 text-xs py-1">
              {editSource === "cloud"
                ? "No cloud models available"
                : "No local models found"}
            </p>
          )}
          <button
            onClick={() => setUseCustom(true)}
            className="text-slate-400 hover:text-slate-600 text-xs mt-1"
          >
            Use a different model...
          </button>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || (!useCustom && !editModel) || (useCustom && !customModel.trim())}
          className="btn-primary text-xs !py-1 !px-3"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
