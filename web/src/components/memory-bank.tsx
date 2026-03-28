"use client";

import { useState, useEffect, useCallback } from "react";

type MemoryEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  sourceUrl: string | null;
  createdAt: string;
  turk: { id: string; name: string; avatar: string } | null;
};

export function MemoryBank({
  projectId,
  hasRunningTurks,
}: {
  projectId: string;
  hasRunningTurks: boolean;
}) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    category: "",
    title: "",
    content: "",
    sourceUrl: "",
  });
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchEntries = useCallback(async () => {
    try {
      const url = activeCategory
        ? `/api/projects/${projectId}/memory?category=${encodeURIComponent(activeCategory)}`
        : `/api/projects/${projectId}/memory`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId, activeCategory]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Poll while turks are running
  useEffect(() => {
    if (!hasRunningTurks) return;
    const interval = setInterval(fetchEntries, 5000);
    return () => clearInterval(interval);
  }, [hasRunningTurks, fetchEntries]);

  const categories = Array.from(new Set(entries.map((e) => e.category)));
  const turkCount = new Set(entries.map((e) => e.turk?.id).filter(Boolean)).size;

  // Group entries by category
  const grouped: Record<string, MemoryEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.category.trim() || !addForm.title.trim() || !addForm.content.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        setAddForm({ category: "", title: "", content: "", sourceUrl: "" });
        setShowAddForm(false);
        fetchEntries();
      }
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(entryId: string) {
    if (!confirm("Delete this memory entry?")) return;
    try {
      await fetch(`/api/projects/${projectId}/memory`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      fetchEntries();
    } catch {
      // ignore
    }
  }

  async function handleCopyForClaude() {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/memory/export?format=markdown`
      );
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  }

  async function handleExportMarkdown() {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/memory/export?format=markdown`
      );
      if (res.ok) {
        const text = await res.text();
        const blob = new Blob([text], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `memory-bank-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    }
  }

  async function handleExportJSON() {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/memory/export?format=json`
      );
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `memory-bank-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-400">
        Loading memory bank...
      </div>
    );
  }

  return (
    <div>
      {/* Summary + Actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-500 text-sm">
          {entries.length} entries from {turkCount} turk{turkCount !== 1 ? "s" : ""} across{" "}
          {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded transition-colors"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            + Add Entry
          </button>
          <button
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded transition-colors"
            onClick={handleExportJSON}
            disabled={entries.length === 0}
          >
            Export JSON
          </button>
          <button
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded transition-colors"
            onClick={handleExportMarkdown}
            disabled={entries.length === 0}
          >
            Export Markdown
          </button>
          <button
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded transition-colors"
            onClick={handleCopyForClaude}
            disabled={entries.length === 0}
          >
            {copied ? "Copied!" : "Copy for Claude"}
          </button>
        </div>
      </div>

      {/* Add Entry Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="card mb-4 space-y-3 border-indigo-200 bg-indigo-50/30"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">
                Category
              </label>
              <input
                type="text"
                className="input w-full text-sm mt-1"
                placeholder="e.g., news, valuation, risk_factor"
                value={addForm.category}
                onChange={(e) =>
                  setAddForm({ ...addForm, category: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Source URL (optional)
              </label>
              <input
                type="url"
                className="input w-full text-sm mt-1"
                placeholder="https://..."
                value={addForm.sourceUrl}
                onChange={(e) =>
                  setAddForm({ ...addForm, sourceUrl: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Title</label>
            <input
              type="text"
              className="input w-full text-sm mt-1"
              placeholder="Short one-line summary"
              value={addForm.title}
              onChange={(e) =>
                setAddForm({ ...addForm, title: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              Content
            </label>
            <textarea
              className="textarea w-full h-24 text-sm mt-1"
              placeholder="Full finding details..."
              value={addForm.content}
              onChange={(e) =>
                setAddForm({ ...addForm, content: e.target.value })
              }
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={adding}
            >
              {adding ? "Adding..." : "Add Entry"}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Category filter pills */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              activeCategory === null
                ? "bg-indigo-100 text-indigo-700"
                : "bg-slate-100 text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveCategory(null)}
          >
            All ({entries.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                activeCategory === cat
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-500 hover:text-slate-700"
              }`}
              onClick={() =>
                setActiveCategory(activeCategory === cat ? null : cat)
              }
            >
              {cat} ({grouped[cat]?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 mb-2">No memory entries yet</p>
          <p className="text-slate-400 text-sm">
            Entries will appear here as turks contribute findings, or add one
            manually.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([category, catEntries]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                  {category}
                </span>
                <span className="text-slate-400 text-xs font-normal">
                  {catEntries.length} entr{catEntries.length !== 1 ? "ies" : "y"}
                </span>
              </h3>
              <div className="space-y-2 mb-4">
                {catEntries.map((entry) => {
                  const isExpanded = expandedIds.has(entry.id);
                  const contentPreview =
                    entry.content.length > 200 && !isExpanded
                      ? entry.content.slice(0, 200) + "..."
                      : entry.content;

                  return (
                    <div
                      key={entry.id}
                      className="border border-indigo-100 rounded-lg p-3 bg-white hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium text-slate-800 cursor-pointer"
                            onClick={() => toggleExpanded(entry.id)}
                          >
                            {entry.title}
                          </p>
                          <p
                            className="text-xs text-slate-500 mt-1 whitespace-pre-wrap cursor-pointer"
                            onClick={() => toggleExpanded(entry.id)}
                          >
                            {contentPreview}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            {entry.sourceUrl && (
                              <a
                                href={entry.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-500 hover:text-indigo-700 underline truncate max-w-[300px]"
                                title={entry.sourceUrl}
                              >
                                {entry.sourceUrl}
                              </a>
                            )}
                            {entry.turk && (
                              <span>by {entry.turk.name}</span>
                            )}
                            {!entry.turk && <span>manually added</span>}
                            <span>
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <button
                          className="text-slate-300 hover:text-red-500 transition-colors text-xs p-1"
                          onClick={() => handleDelete(entry.id)}
                          title="Delete entry"
                        >
                          &times;
                        </button>
                      </div>
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
