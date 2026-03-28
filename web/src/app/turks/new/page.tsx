"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CredentialPicker } from "@/components/credential-picker";
import { EnhanceInstructions } from "@/components/enhance-instructions";

type OllamaModel = { name: string };
type Project = { id: string; name: string };

export default function NewTurkPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl"><p className="text-slate-500">Loading...</p></div>}>
      <NewTurkForm />
    </Suspense>
  );
}

function NewTurkForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId") || "";

  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [cloudModels, setCloudModels] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [hasCloudKey, setHasCloudKey] = useState(false);
  const [cloudKeyMasked, setCloudKeyMasked] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState("");
  const [modelSource, setModelSource] = useState<"local" | "cloud">("local");
  const [form, setForm] = useState({
    name: "",
    targetUrl: "",
    instructions: "",
    ollamaModel: "",
    credentialGroupIds: [] as string[],
    projectId: preselectedProjectId,
  });

  const fetchModels = useCallback(() => {
    fetch("/api/ollama/models")
      .then((r) => r.json())
      .then((data: OllamaModel[]) => {
        if (data.length > 0) {
          const names = data.map((m) => m.name);
          setModels(names);
          setOllamaOnline(true);
          if (modelSource === "local") {
            setForm((f) => ({
              ...f,
              ollamaModel: f.ollamaModel || names[0],
            }));
          }
        } else {
          setOllamaOnline(false);
        }
      })
      .catch(() => setOllamaOnline(false));
  }, [modelSource]);

  const fetchCloudModels = useCallback(() => {
    setCloudError("");
    fetch("/api/ollama/cloud-models")
      .then((r) => r.json())
      .then((data: { models?: OllamaModel[]; hasKey?: boolean; error?: string; authError?: boolean }) => {
        // Let fetchKeyStatus be the single source of truth for hasCloudKey
        if (data.authError) {
          setCloudError("API key is invalid or expired. Please update it.");
          setCloudModels([]);
        } else if (data.error && data.hasKey) {
          setCloudError(data.error);
          setCloudModels([]);
        } else if (data.models && data.models.length > 0) {
          const names = data.models.map((m) => m.name);
          setCloudModels(names);
        } else {
          setCloudModels([]);
        }
      })
      .catch(() => {
        setCloudError("Could not reach cloud models API");
      });
  }, []);

  const fetchKeyStatus = useCallback(() => {
    fetch("/api/settings?key=OLLAMA_API_KEY")
      .then((r) => r.json())
      .then((data: { hasValue?: boolean; masked?: string }) => {
        setHasCloudKey(!!data.hasValue);
        setCloudKeyMasked(data.masked || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchModels();
    fetchCloudModels();
    fetchKeyStatus();
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => setProjects(data))
      .catch(() => {});
  }, [fetchModels, fetchCloudModels, fetchKeyStatus]);

  // When switching model source, auto-select first available model
  useEffect(() => {
    if (modelSource === "local" && models.length > 0) {
      setForm((f) => ({
        ...f,
        ollamaModel: f.ollamaModel && models.includes(f.ollamaModel) ? f.ollamaModel : models[0],
      }));
    } else if (modelSource === "cloud" && cloudModels.length > 0) {
      setForm((f) => ({
        ...f,
        ollamaModel: f.ollamaModel && cloudModels.includes(f.ollamaModel) ? f.ollamaModel : cloudModels[0],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelSource]);

  async function handleSaveApiKey() {
    const key = apiKeyInput.trim();
    if (!key) return;
    setSavingKey(true);
    setKeyMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OLLAMA_API_KEY", value: key }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setHasCloudKey(true);
      setCloudKeyMasked(data.masked || "");
      setApiKeyInput("");
      setKeyMessage("API key saved! Loading cloud models...");
      // Re-fetch cloud models now that we have a key
      fetchCloudModels();
      setTimeout(() => setKeyMessage(""), 3000);
    } catch {
      setKeyMessage("Error saving API key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleRemoveApiKey() {
    if (!confirm("Remove the Ollama Cloud API key?")) return;
    setSavingKey(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OLLAMA_API_KEY", value: "" }),
      });
      setHasCloudKey(false);
      setCloudKeyMasked("");
      setCloudModels([]);
      setKeyMessage("");
      if (modelSource === "cloud") {
        setModelSource("local");
        if (models.length > 0) {
          setForm((f) => ({ ...f, ollamaModel: models[0] }));
        }
      }
    } catch {
      setKeyMessage("Error removing API key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handlePull() {
    const modelName = customModel.trim();
    if (!modelName) return;
    setPulling(true);
    setPullProgress("Starting pull...");
    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Pull failed");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n").filter(Boolean)) {
          try {
            const msg = JSON.parse(line);
            if (msg.total && msg.completed) {
              const pct = Math.round((msg.completed / msg.total) * 100);
              setPullProgress(`${msg.status} ${pct}%`);
            } else if (msg.status) {
              setPullProgress(msg.status);
            }
          } catch { /* ignore parse errors */ }
        }
      }
      setPullProgress("Done! Refreshing models...");
      fetchModels();
      setForm((f) => ({ ...f, ollamaModel: modelName }));
      setUseCustom(false);
      setCustomModel("");
      setPullProgress("");
    } catch (err) {
      setPullProgress(
        `Error: ${err instanceof Error ? err.message : "Pull failed"}`
      );
    } finally {
      setPulling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modelSource === "cloud" && !hasCloudKey) {
      alert("Please save an Ollama Cloud API key before creating a cloud turk.");
      return;
    }
    if (!form.ollamaModel.trim()) {
      alert("Please select a model.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/turks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, modelSource }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create turk");
      }
      const turk = await res.json();
      router.push(`/turks/${turk.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create turk");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Create New Turk</h1>
      <p className="text-slate-500 mb-8">
        Set up a new AI testing agent to test your website
      </p>

      {modelSource === "local" && ollamaOnline === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-amber-700 text-sm font-medium">
            Ollama is not reachable
          </p>
          <p className="text-amber-600 text-sm mt-1">
            Make sure Ollama is running locally ({"`ollama serve`"}) and has at
            least one model pulled ({"`ollama pull llama3`"}).
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project selector */}
        <div>
          <label className="label">Project</label>
          <select
            className="input w-full"
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          >
            <option value="">No project (unassigned)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-slate-400 text-xs mt-1">
            Assign this turk to a project, or leave unassigned.
          </p>
        </div>

        <div>
          <label className="label">Name</label>
          <input
            type="text"
            className="input w-full"
            placeholder="e.g., Login Flow Tester"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label">Target URL</label>
          <input
            type="url"
            className="input w-full"
            placeholder="https://example.com"
            value={form.targetUrl}
            onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label">Instructions</label>
          <textarea
            className="textarea w-full h-40"
            placeholder={`Describe what this turk should test. Be specific about flows, edge cases, and what to look for.\n\nExample: Test the login flow with valid and invalid credentials. Check that error messages appear correctly. Verify the forgot password flow works. Test session timeout behavior.`}
            value={form.instructions}
            onChange={(e) =>
              setForm({ ...form, instructions: e.target.value })
            }
            required
          />
          <EnhanceInstructions
            instructions={form.instructions}
            targetUrl={form.targetUrl}
            onEnhanced={(enhanced) =>
              setForm({ ...form, instructions: enhanced })
            }
          />
        </div>

        {/* Model Source + Selector */}
        <div>
          <label className="label">Model</label>

          {/* Local / Cloud toggle */}
          <div className="flex rounded-lg bg-slate-100 p-1 mb-3">
            <button
              type="button"
              className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-all ${
                modelSource === "local"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => {
                setModelSource("local");
                setUseCustom(false);
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Local Ollama
              </span>
            </button>
            <button
              type="button"
              className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-all ${
                modelSource === "cloud"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => {
                setModelSource("cloud");
                setUseCustom(false);
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                Ollama Cloud
              </span>
            </button>
          </div>

          {/* ── CLOUD: API Key management ── */}
          {modelSource === "cloud" && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">
                  Ollama Cloud API Key
                </p>
                {hasCloudKey && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </span>
                )}
              </div>

              {hasCloudKey ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-500 font-mono">
                    {cloudKeyMasked || "****"}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:text-red-700 underline whitespace-nowrap"
                    onClick={handleRemoveApiKey}
                    disabled={savingKey}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="input flex-1 text-sm"
                      placeholder="Paste your API key"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      disabled={savingKey}
                    />
                    <button
                      type="button"
                      className="btn-primary text-sm whitespace-nowrap"
                      onClick={handleSaveApiKey}
                      disabled={savingKey || !apiKeyInput.trim()}
                    >
                      {savingKey ? "Saving..." : "Save Key"}
                    </button>
                  </div>
                  <p className="text-slate-400 text-xs mt-1.5">
                    Get your key at{" "}
                    <a
                      href="https://ollama.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-turk-600 hover:text-turk-700 underline"
                    >
                      ollama.com/settings/keys
                    </a>
                    . Stored encrypted in the database.
                  </p>
                </>
              )}

              {keyMessage && (
                <p className={`text-xs mt-2 ${keyMessage.startsWith("Error") ? "text-red-500" : "text-emerald-600"}`}>
                  {keyMessage}
                </p>
              )}
            </div>
          )}

          {/* LOCAL model selector */}
          {modelSource === "local" && (
            <>
              {!useCustom ? (
                <>
                  <select
                    className="input w-full"
                    value={form.ollamaModel}
                    onChange={(e) =>
                      setForm({ ...form, ollamaModel: e.target.value })
                    }
                  >
                    {models.length === 0 && (
                      <option value="" disabled>
                        No models available
                      </option>
                    )}
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between mt-1">
                    {ollamaOnline && (
                      <p className="text-slate-400 text-xs">
                        {models.length} model(s) available from local Ollama
                      </p>
                    )}
                    <button
                      type="button"
                      className="text-turk-600 hover:text-turk-700 text-xs underline"
                      onClick={() => setUseCustom(true)}
                    >
                      Pull a different model
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="e.g., llama3.1:8b, qwen3:14b"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      disabled={pulling}
                    />
                    <button
                      type="button"
                      className="btn-primary whitespace-nowrap"
                      onClick={handlePull}
                      disabled={pulling || !customModel.trim()}
                    >
                      {pulling ? "Pulling..." : "Pull Model"}
                    </button>
                  </div>
                  {pullProgress && (
                    <p className={`text-xs mt-1 ${pullProgress.startsWith("Error") ? "text-red-500" : "text-slate-500"}`}>
                      {pullProgress}
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-700 text-xs underline mt-1"
                    onClick={() => {
                      setUseCustom(false);
                      setPullProgress("");
                    }}
                  >
                    Back to available models
                  </button>
                </>
              )}
            </>
          )}

          {/* Cloud error banner */}
          {modelSource === "cloud" && hasCloudKey && cloudError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3">
              <p className="text-red-700 text-sm font-medium">
                {cloudError}
              </p>
            </div>
          )}

          {/* CLOUD model selector */}
          {modelSource === "cloud" && hasCloudKey && (
            <>
              {!useCustom ? (
                <>
                  <select
                    className="input w-full"
                    value={form.ollamaModel}
                    onChange={(e) =>
                      setForm({ ...form, ollamaModel: e.target.value })
                    }
                  >
                    {cloudModels.length === 0 && (
                      <option value="" disabled>
                        No cloud models found
                      </option>
                    )}
                    {cloudModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-slate-400 text-xs">
                      {cloudModels.length} model(s) available from Ollama Cloud
                    </p>
                    <button
                      type="button"
                      className="text-turk-600 hover:text-turk-700 text-xs underline"
                      onClick={() => setUseCustom(true)}
                    >
                      Use a different cloud model
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="e.g., qwen3-coder:480b, deepseek-v3.1:671b"
                      value={form.ollamaModel}
                      onChange={(e) =>
                        setForm({ ...form, ollamaModel: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    Enter the exact model name available on Ollama Cloud.
                  </p>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-700 text-xs underline mt-1"
                    onClick={() => {
                      setUseCustom(false);
                      if (cloudModels.length > 0) {
                        setForm((f) => ({ ...f, ollamaModel: cloudModels[0] }));
                      }
                    }}
                  >
                    Back to available models
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div>
          <label className="label">Credentials (optional)</label>
          <p className="text-slate-400 text-sm mb-3">
            Attach credential groups so the agent can log in to the site.
          </p>
          <CredentialPicker
            selected={form.credentialGroupIds}
            onChange={(ids) =>
              setForm({ ...form, credentialGroupIds: ids })
            }
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create Turk"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
