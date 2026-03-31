"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  INVESTOR_TURK_TEMPLATES,
  STOCK_SYMBOL_PLACEHOLDER,
  resolveSymbol,
  SUGGESTED_TURK_IDS,
} from "@/lib/investor-turk-templates";

interface MemoryEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  sourceUrl: string | null;
  createdAt: string;
  turk: { id: string; name: string; avatar: string } | null;
}

interface TurkData {
  id: string;
  name: string;
  status: string;
  role: string;
  avatar: string;
  targetUrl: string;
  _count: { memoryEntries: number };
}

interface InvestorProjectData {
  id: string;
  ticker: string;
  companyName: string;
  exchange: string;
  lastRunAt: string | null;
  project: {
    id: string;
    name: string;
    status: string;
    objective: string;
    _count: { turks: number; memoryEntries: number };
    turks: TurkData[];
    memoryEntries: MemoryEntry[];
  };
}

const categoryLabels: Record<string, string> = {
  company_profile: "Company Profile",
  financial_data: "Financial Data",
  valuation: "Valuation",
  growth: "Growth Analysis",
  returns: "Expected Returns",
  news: "News",
  risk_factor: "Risk Factors",
  analyst_report: "Analyst Reports",
};

const categoryColors: Record<string, string> = {
  company_profile: "bg-blue-100 text-blue-700",
  financial_data: "bg-slate-100 text-slate-700",
  valuation: "bg-amber-100 text-amber-700",
  growth: "bg-emerald-100 text-emerald-700",
  returns: "bg-purple-100 text-purple-700",
  news: "bg-cyan-100 text-cyan-700",
  risk_factor: "bg-red-100 text-red-700",
  analyst_report: "bg-indigo-100 text-indigo-700",
};

export function InvestorProjectView({
  projectId,
  ticker,
  companyName,
  exchange,
}: {
  projectId: string;
  ticker: string;
  companyName: string;
  exchange: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<InvestorProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAddTurk, setShowAddTurk] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [turkForm, setTurkForm] = useState({ name: "", targetUrl: "", instructions: "", role: "" });
  const [creatingTurk, setCreatingTurk] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/investor`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/investor/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Run failed");
      }
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this stock research and all its data?")) return;
    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      router.push("/projects");
    } catch {
      alert("Failed to delete");
    }
  }

  function toggleEntry(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectTemplate(templateId: string) {
    const tmpl = INVESTOR_TURK_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    setSelectedTemplate(templateId);
    setTurkForm({
      name: resolveSymbol(tmpl.name, ticker),
      targetUrl: resolveSymbol(tmpl.defaultUrl, ticker),
      instructions: resolveSymbol(tmpl.instructions, ticker),
      role: tmpl.role,
    });
  }

  async function handleCreateTurk() {
    if (!turkForm.name || !turkForm.targetUrl || !turkForm.instructions) return;
    setCreatingTurk(true);
    try {
      const res = await fetch("/api/turks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: turkForm.name,
          targetUrl: turkForm.targetUrl,
          instructions: turkForm.instructions,
          role: turkForm.role,
          projectId,
          ollamaModel: "",
          modelSource: "local",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create turk");
      }
      setShowAddTurk(false);
      setSelectedTemplate(null);
      setTurkForm({ name: "", targetUrl: "", instructions: "", role: "" });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create turk");
    } finally {
      setCreatingTurk(false);
    }
  }

  async function handleAddSuggestedTurks() {
    setCreatingTurk(true);
    try {
      const suggestedTemplates = INVESTOR_TURK_TEMPLATES.filter((t) =>
        SUGGESTED_TURK_IDS.includes(t.id)
      );
      for (const tmpl of suggestedTemplates) {
        const res = await fetch("/api/turks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: resolveSymbol(tmpl.name, ticker),
            targetUrl: resolveSymbol(tmpl.defaultUrl, ticker),
            instructions: resolveSymbol(tmpl.instructions, ticker),
            role: tmpl.role,
            projectId,
            ollamaModel: "",
            modelSource: "local",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create turk");
        }
      }
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add turks");
    } finally {
      setCreatingTurk(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-turk-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card text-center py-16">
        <p className="text-slate-500 mb-4">Stock research not found</p>
        <Link href="/projects" className="btn-primary">
          Back to Projects
        </Link>
      </div>
    );
  }

  const entries = data.project.memoryEntries;
  const categories = [...new Set(entries.map((e) => e.category))];
  const filteredEntries = activeCategory
    ? entries.filter((e) => e.category === activeCategory)
    : entries;

  const grouped = filteredEntries.reduce<Record<string, MemoryEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});

  const statusColor: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
  };

  const suggestedTemplates = INVESTOR_TURK_TEMPLATES.filter((t) =>
    SUGGESTED_TURK_IDS.includes(t.id)
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/projects" className="text-slate-400 hover:text-slate-600 text-sm">
          Projects
        </Link>
        <span className="text-slate-300 text-sm">/</span>
        <span className="text-slate-500 text-sm">{companyName || ticker}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <span className="text-amber-700 font-bold text-lg">{ticker}</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-800">
                {companyName || ticker}
              </h1>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                  statusColor[data.project.status] || statusColor.draft
                }`}
              >
                {data.project.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-slate-500 mt-1">
              {exchange} &middot; {ticker}
              {data.lastRunAt && (
                <span>
                  {" "}
                  &middot; Last analyzed{" "}
                  {new Date(data.lastRunAt).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="btn-primary flex items-center gap-2"
          >
            {running ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {entries.length > 0 ? "Re-run Analysis" : "Run Analysis"}
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            className="btn-secondary text-red-600 hover:text-red-700 hover:border-red-300"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card">
          <p className="text-slate-400 text-sm">Turks</p>
          <p className="text-2xl font-bold text-slate-800">{data.project.turks.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm">Data Points</p>
          <p className="text-2xl font-bold text-slate-800">{entries.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm">Categories</p>
          <p className="text-2xl font-bold text-slate-800">{categories.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm">Status</p>
          <p className="text-2xl font-bold text-slate-800 capitalize">
            {data.project.status.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Suggested Turks — show only when no turks exist yet */}
      {data.project.turks.length === 0 && !showAddTurk && (
        <div className="card border-amber-200 bg-amber-50/40 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 mb-1">
                Get started with suggested turks
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                These specialist turks are pre-configured to research {ticker}. Each one targets a different data source to build a comprehensive picture.
              </p>
              <div className="grid gap-2 mb-4">
                {suggestedTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-amber-100"
                  >
                    <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 text-sm">{tmpl.name}</span>
                        <span className="text-slate-400 text-xs">{tmpl.role}</span>
                      </div>
                      <p className="text-slate-400 text-xs truncate">{tmpl.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddSuggestedTurks}
                  disabled={creatingTurk}
                  className="btn-primary text-sm"
                >
                  {creatingTurk ? "Adding..." : `Add all ${suggestedTemplates.length} turks`}
                </button>
                <button
                  onClick={() => setShowAddTurk(true)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Or pick individually...
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Turks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">
            Research Turks
            {data.project.turks.length > 0 && (
              <span className="text-slate-400 text-sm font-normal ml-2">
                ({data.project.turks.length})
              </span>
            )}
          </h2>
          {data.project.turks.length > 0 && (
            <button
              onClick={() => setShowAddTurk(!showAddTurk)}
              className="text-sm text-turk-600 hover:text-turk-700 font-medium"
            >
              {showAddTurk ? "Cancel" : "+ Add Turk"}
            </button>
          )}
        </div>

        {/* Existing turks */}
        {data.project.turks.length > 0 && (
          <div className="grid gap-3 mb-4">
            {data.project.turks.map((turk) => {
              const statusStyles: Record<string, string> = {
                stopped: "bg-slate-100 text-slate-600",
                starting: "bg-amber-100 text-amber-700",
                running: "bg-emerald-100 text-emerald-700",
                paused: "bg-blue-100 text-blue-700",
                error: "bg-red-100 text-red-700",
              };
              return (
                <Link key={turk.id} href={`/turks/${turk.id}`}>
                  <div className="card hover:border-turk-400 transition-colors cursor-pointer py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={`/avatars/${turk.avatar}`}
                          alt={turk.name}
                          className="w-8 h-8 rounded-lg"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 text-sm">{turk.name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusStyles[turk.status] || statusStyles.stopped}`}>
                              {turk.status}
                            </span>
                          </div>
                          {turk.role && (
                            <p className="text-slate-400 text-xs">{turk.role}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        {turk._count.memoryEntries > 0 && (
                          <span>{turk._count.memoryEntries} entries</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Add Turk Panel */}
        {showAddTurk && (
          <div className="card border-turk-200 bg-turk-50/30">
            {!selectedTemplate ? (
              <>
                <h3 className="font-medium text-slate-800 mb-3">Choose a turk template</h3>
                <p className="text-slate-500 text-sm mb-4">
                  Each template comes with a pre-configured URL and instructions optimized for {ticker}.
                  The <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{STOCK_SYMBOL_PLACEHOLDER}</code> placeholder
                  is automatically replaced with <strong>{ticker}</strong>.
                </p>
                <div className="grid gap-2">
                  {INVESTOR_TURK_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className="text-left p-3 rounded-lg border border-slate-200 bg-white hover:border-turk-400 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 text-sm">{tmpl.name}</span>
                          <span className="text-slate-400 text-xs ml-2">{tmpl.role}</span>
                        </div>
                        <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">{tmpl.description}</p>
                      <p className="text-slate-400 text-xs mt-1 font-mono truncate">
                        {resolveSymbol(tmpl.defaultUrl, ticker)}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setSelectedTemplate("custom");
                      setTurkForm({ name: "", targetUrl: "", instructions: "", role: "" });
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Or create a custom turk from scratch...
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-800">
                    {selectedTemplate === "custom" ? "Custom Turk" : "Configure Turk"}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setTurkForm({ name: "", targetUrl: "", instructions: "", role: "" });
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Back to templates
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="label">Name</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="e.g., SeekingAlpha News Reader"
                      value={turkForm.name}
                      onChange={(e) => setTurkForm({ ...turkForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="e.g., News Monitor, Valuation Analyst"
                      value={turkForm.role}
                      onChange={(e) => setTurkForm({ ...turkForm, role: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Target URL</label>
                    <input
                      type="text"
                      className="input w-full font-mono text-sm"
                      placeholder={`https://example.com/symbol/${STOCK_SYMBOL_PLACEHOLDER}`}
                      value={turkForm.targetUrl}
                      onChange={(e) => setTurkForm({ ...turkForm, targetUrl: e.target.value })}
                    />
                    <p className="text-slate-400 text-xs mt-1">
                      Use <code className="bg-slate-100 px-1 py-0.5 rounded">{STOCK_SYMBOL_PLACEHOLDER}</code> in the URL — it will be replaced with <strong>{ticker}</strong> when the turk starts.
                    </p>
                  </div>
                  <div>
                    <label className="label">Instructions</label>
                    <textarea
                      className="textarea w-full h-40 text-sm"
                      placeholder="Describe what this turk should research and how to report findings..."
                      value={turkForm.instructions}
                      onChange={(e) => setTurkForm({ ...turkForm, instructions: e.target.value })}
                    />
                    <p className="text-slate-400 text-xs mt-1">
                      Context-engineered instructions tell the turk exactly what data to collect, how to navigate the site, and how to report findings.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateTurk}
                      disabled={creatingTurk || !turkForm.name || !turkForm.targetUrl || !turkForm.instructions}
                      className="btn-primary"
                    >
                      {creatingTurk ? "Creating..." : "Create Turk"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddTurk(false);
                        setSelectedTemplate(null);
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Category filter pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === null
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({entries.length})
          </button>
          {categories.map((cat) => {
            const count = entries.filter((e) => e.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-slate-800 text-white"
                    : `${categoryColors[cat] || "bg-slate-100 text-slate-600"} hover:opacity-80`
                }`}
              >
                {categoryLabels[cat] || cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Data entries */}
      {entries.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <p className="text-slate-500 mb-2">No data collected yet</p>
          <p className="text-slate-400 text-sm">
            Click &ldquo;Run Analysis&rdquo; to fetch valuation data from the M4th.com API, or add research turks to browse financial sites.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, catEntries]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    categoryColors[category] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {categoryLabels[category] || category}
                </span>
                <span className="text-slate-400 text-sm font-normal">
                  {catEntries.length} {catEntries.length === 1 ? "entry" : "entries"}
                </span>
              </h2>
              <div className="space-y-3">
                {catEntries.map((entry) => {
                  const isExpanded = expandedEntries.has(entry.id);
                  let contentPreview = entry.content;
                  let isJson = false;

                  try {
                    JSON.parse(entry.content);
                    isJson = true;
                  } catch {
                    // not JSON
                  }

                  if (!isExpanded && contentPreview.length > 200) {
                    contentPreview = contentPreview.substring(0, 200) + "...";
                  }

                  return (
                    <div
                      key={entry.id}
                      className="card cursor-pointer hover:border-slate-300 transition-colors"
                      onClick={() => toggleEntry(entry.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-slate-800">{entry.title}</h3>
                        <span className="text-slate-400 text-xs whitespace-nowrap ml-4">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div
                        className={`text-sm text-slate-600 ${
                          isExpanded ? "" : "line-clamp-3"
                        }`}
                      >
                        {isJson && isExpanded ? (
                          <pre className="bg-slate-50 rounded p-3 overflow-x-auto text-xs">
                            {entry.content}
                          </pre>
                        ) : (
                          <p className="whitespace-pre-wrap">{contentPreview}</p>
                        )}
                      </div>
                      {entry.content.length > 200 && (
                        <p className="text-turk-600 text-xs mt-2">
                          {isExpanded ? "Click to collapse" : "Click to expand"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
