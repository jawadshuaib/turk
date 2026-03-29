"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  // ─── Ollama Base URL ───────────────────────────────────
  const [baseUrl, setBaseUrl] = useState("");
  const [savedBaseUrl, setSavedBaseUrl] = useState("");
  const [baseUrlLoading, setBaseUrlLoading] = useState(true);
  const [baseUrlSaving, setBaseUrlSaving] = useState(false);
  const [baseUrlStatus, setBaseUrlStatus] = useState<
    "idle" | "saved" | "cleared" | "error"
  >("idle");
  const [ollamaHealthy, setOllamaHealthy] = useState<boolean | null>(null);

  // ─── Ollama API Key ────────────────────────────────────
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<
    "idle" | "saved" | "cleared" | "error"
  >("idle");

  // Load current settings
  useEffect(() => {
    async function loadSettings() {
      try {
        // Load base URL
        const urlRes = await fetch("/api/settings?key=OLLAMA_BASE_URL");
        if (urlRes.ok) {
          const data = await urlRes.json();
          if (data.hasValue && data.value) {
            setBaseUrl(data.value);
            setSavedBaseUrl(data.value);
          }
        }

        // Load API key
        const keyRes = await fetch("/api/settings?key=OLLAMA_API_KEY");
        if (keyRes.ok) {
          const data = await keyRes.json();
          setHasApiKey(data.hasValue);
          if (data.masked) setApiKeyMasked(data.masked);
        }
      } catch {
        // ignore
      } finally {
        setBaseUrlLoading(false);
        setApiKeyLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Check Ollama health when base URL changes
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/ollama/models");
        setOllamaHealthy(res.ok);
      } catch {
        setOllamaHealthy(false);
      }
    }
    checkHealth();
  }, [savedBaseUrl]);

  async function handleSaveBaseUrl() {
    setBaseUrlSaving(true);
    setBaseUrlStatus("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OLLAMA_BASE_URL", value: baseUrl.trim() }),
      });
      if (res.ok) {
        setSavedBaseUrl(baseUrl.trim());
        setBaseUrlStatus("saved");
        setTimeout(() => setBaseUrlStatus("idle"), 3000);
      } else {
        setBaseUrlStatus("error");
      }
    } catch {
      setBaseUrlStatus("error");
    } finally {
      setBaseUrlSaving(false);
    }
  }

  async function handleClearBaseUrl() {
    setBaseUrlSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OLLAMA_BASE_URL", value: "" }),
      });
      if (res.ok) {
        setBaseUrl("");
        setSavedBaseUrl("");
        setBaseUrlStatus("cleared");
        setTimeout(() => setBaseUrlStatus("idle"), 3000);
      }
    } catch {
      setBaseUrlStatus("error");
    } finally {
      setBaseUrlSaving(false);
    }
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) return;
    setApiKeySaving(true);
    setApiKeyStatus("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OLLAMA_API_KEY", value: apiKey.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(true);
        setApiKeyMasked(data.masked || "****");
        setApiKey("");
        setApiKeyStatus("saved");
        setTimeout(() => setApiKeyStatus("idle"), 3000);
      } else {
        setApiKeyStatus("error");
      }
    } catch {
      setApiKeyStatus("error");
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleClearApiKey() {
    if (!confirm("Remove the Ollama Cloud API key?")) return;
    setApiKeySaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OLLAMA_API_KEY", value: "" }),
      });
      if (res.ok) {
        setHasApiKey(false);
        setApiKeyMasked("");
        setApiKeyStatus("cleared");
        setTimeout(() => setApiKeyStatus("idle"), 3000);
      }
    } catch {
      setApiKeyStatus("error");
    } finally {
      setApiKeySaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Settings</h1>
      <p className="text-slate-500 text-sm mb-8">
        Configure your Ollama connection and API keys.
      </p>

      {/* Ollama Base URL */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Ollama Base URL
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              The URL where your Ollama instance is running. Leave empty to use
              the default from <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">.env</code> or{" "}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">http://localhost:11434</code>.
            </p>
          </div>
          {ollamaHealthy !== null && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                ollamaHealthy
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {ollamaHealthy ? "Connected" : "Unreachable"}
            </span>
          )}
        </div>

        {baseUrlLoading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="url"
                className="input flex-1"
                placeholder="http://localhost:11434"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <button
                className="btn-primary text-sm"
                onClick={handleSaveBaseUrl}
                disabled={baseUrlSaving || !baseUrl.trim()}
              >
                {baseUrlSaving ? "Saving..." : "Save"}
              </button>
              {savedBaseUrl && (
                <button
                  className="btn-secondary text-sm"
                  onClick={handleClearBaseUrl}
                  disabled={baseUrlSaving}
                >
                  Reset
                </button>
              )}
            </div>
            {baseUrlStatus === "saved" && (
              <p className="text-emerald-600 text-xs mt-2">
                Ollama URL saved. New turks will use this URL.
              </p>
            )}
            {baseUrlStatus === "cleared" && (
              <p className="text-slate-500 text-xs mt-2">
                Cleared. Will fall back to .env or default (localhost:11434).
              </p>
            )}
            {baseUrlStatus === "error" && (
              <p className="text-red-600 text-xs mt-2">
                Failed to save. Please try again.
              </p>
            )}
          </>
        )}
      </div>

      {/* Ollama Cloud API Key */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Ollama Cloud API Key
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Required for running turks with cloud-hosted Ollama models.
          Get a key from{" "}
          <a
            href="https://ollama.com/account"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turk-600 hover:text-turk-700 underline"
          >
            ollama.com/account
          </a>
          .
        </p>

        {apiKeyLoading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : hasApiKey ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-sm font-mono text-slate-600">
                {apiKeyMasked}
              </span>
            </div>
            <button
              className="text-sm text-red-500 hover:text-red-700 font-medium"
              onClick={handleClearApiKey}
              disabled={apiKeySaving}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="password"
                className="input flex-1"
                placeholder="Enter API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                className="btn-primary text-sm"
                onClick={handleSaveApiKey}
                disabled={apiKeySaving || !apiKey.trim()}
              >
                {apiKeySaving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
        {apiKeyStatus === "saved" && (
          <p className="text-emerald-600 text-xs mt-2">
            API key saved and encrypted.
          </p>
        )}
        {apiKeyStatus === "cleared" && (
          <p className="text-slate-500 text-xs mt-2">
            API key removed.
          </p>
        )}
        {apiKeyStatus === "error" && (
          <p className="text-red-600 text-xs mt-2">
            Failed to save. Please try again.
          </p>
        )}
      </div>

      {/* Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-2">How it works</p>
        <ul className="space-y-1 list-disc list-inside text-xs text-slate-500">
          <li>Settings saved here take priority over <code className="bg-white px-1 py-0.5 rounded">.env</code> values.</li>
          <li>Clear a setting to fall back to the <code className="bg-white px-1 py-0.5 rounded">.env</code> value.</li>
          <li>API keys are encrypted at rest. The Base URL is stored as plain text.</li>
          <li>Agent containers automatically translate <code className="bg-white px-1 py-0.5 rounded">localhost</code> to <code className="bg-white px-1 py-0.5 rounded">host.docker.internal</code>.</li>
        </ul>
      </div>
    </div>
  );
}
