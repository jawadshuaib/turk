"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CredentialPicker } from "@/components/credential-picker";
import { EnhanceInstructions } from "@/components/enhance-instructions";

type OllamaModel = { name: string };

export default function NewTurkPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [customModel, setCustomModel] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState("");
  const [form, setForm] = useState({
    name: "",
    targetUrl: "",
    instructions: "",
    ollamaModel: "",
    credentialGroupIds: [] as string[],
  });

  const fetchModels = useCallback(() => {
    fetch("/api/ollama/models")
      .then((r) => r.json())
      .then((data: OllamaModel[]) => {
        if (data.length > 0) {
          const names = data.map((m) => m.name);
          setModels(names);
          setOllamaOnline(true);
          setForm((f) => ({
            ...f,
            ollamaModel: f.ollamaModel || names[0],
          }));
        } else {
          setOllamaOnline(false);
        }
      })
      .catch(() => setOllamaOnline(false));
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

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
      // Refresh model list and select the new model
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
    setLoading(true);
    try {
      const res = await fetch("/api/turks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      <h1 className="text-3xl font-bold text-white mb-2">Create New Turk</h1>
      <p className="text-gray-400 mb-8">
        Set up a new AI testing agent to test your website
      </p>

      {ollamaOnline === false && (
        <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg px-4 py-3 mb-6">
          <p className="text-yellow-300 text-sm font-medium">
            Ollama is not reachable
          </p>
          <p className="text-yellow-400/70 text-sm mt-1">
            Make sure Ollama is running locally ({"`ollama serve`"}) and has at
            least one model pulled ({"`ollama pull llama3`"}).
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div>
          <label className="label">Ollama Model</label>
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
                  <p className="text-gray-600 text-xs">
                    {models.length} model(s) available from Ollama
                  </p>
                )}
                <button
                  type="button"
                  className="text-turk-400 hover:text-turk-300 text-xs underline"
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
                <p className={`text-xs mt-1 ${pullProgress.startsWith("Error") ? "text-red-400" : "text-gray-400"}`}>
                  {pullProgress}
                </p>
              )}
              <button
                type="button"
                className="text-gray-500 hover:text-gray-300 text-xs underline mt-1"
                onClick={() => {
                  setUseCustom(false);
                  setPullProgress("");
                }}
              >
                Back to available models
              </button>
            </>
          )}
        </div>

        <div>
          <label className="label">Credentials (optional)</label>
          <p className="text-gray-500 text-sm mb-3">
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
