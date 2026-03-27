"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CredentialPicker } from "@/components/credential-picker";
import { EnhanceInstructions } from "@/components/enhance-instructions";

type OllamaModel = { name: string };

const FALLBACK_MODELS = [
  "llama3",
  "llama3:70b",
  "mistral",
  "codellama",
  "qwen2",
];

export default function NewTurkPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    name: "",
    targetUrl: "",
    instructions: "",
    ollamaModel: "llama3",
    credentialGroupIds: [] as string[],
  });

  useEffect(() => {
    fetch("/api/ollama/models")
      .then((r) => r.json())
      .then((data: OllamaModel[]) => {
        if (data.length > 0) {
          setModels(data.map((m) => m.name));
          setOllamaOnline(true);
          // Default to first available model
          setForm((f) => ({ ...f, ollamaModel: data[0].name }));
        } else {
          setOllamaOnline(false);
        }
      })
      .catch(() => setOllamaOnline(false));
  }, []);

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
          <select
            className="input w-full"
            value={form.ollamaModel}
            onChange={(e) =>
              setForm({ ...form, ollamaModel: e.target.value })
            }
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {ollamaOnline && (
            <p className="text-gray-600 text-xs mt-1">
              {models.length} model(s) available from Ollama
            </p>
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
