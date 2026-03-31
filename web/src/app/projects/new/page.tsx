"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type ProjectType = null | "general" | "investor";

interface TickerResult {
  ticker: string;
  name: string;
  exchange: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [projectType, setProjectType] = useState<ProjectType>(null);

  // General project form
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", objective: "" });

  // Investor project form
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);
  const [tickerLoading, setTickerLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<TickerResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (selected) return;
    if (query.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setTickerLoading(true);
      try {
        const res = await fetch(`/api/investor/ticker-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setTickerLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  async function handleGeneralSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvestorCreate() {
    if (!selected) return;
    setCreating(true);
    try {
      const res = await fetch("/api/investor/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selected.ticker,
          companyName: selected.name,
          exchange: selected.exchange,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create");
      }
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  function handleSelectTicker(result: TickerResult) {
    setSelected(result);
    setQuery(result.ticker);
    setShowDropdown(false);
  }

  function handleClearTicker() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  // Step 1: Choose project type
  if (!projectType) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          New Project
        </h1>
        <p className="text-slate-500 mb-8">
          Choose the type of project you want to create.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Turk of All Trades */}
          <button
            onClick={() => setProjectType("general")}
            className="card text-left hover:border-turk-400 hover:shadow-md transition-all cursor-pointer group p-6"
          >
            <div className="w-14 h-14 rounded-xl bg-turk-50 flex items-center justify-center mb-4 group-hover:bg-turk-100 transition-colors">
              <svg className="w-7 h-7 text-turk-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Turk of All Trades
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Create a general-purpose project with custom turks for web testing, QA, research, or anything else. Full flexibility to define your own turk roles and targets.
            </p>
            <div className="mt-4 text-turk-600 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Get started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* The Turk Investor */}
          <button
            onClick={() => setProjectType("investor")}
            className="card text-left hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group p-6"
          >
            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              The Turk Investor
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Research a stock with specialized AI turks that gather valuation data, financial metrics, analyst reports, and news from multiple sources.
            </p>
            <div className="mt-4 text-amber-600 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Get started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Step 2a: General project form
  if (projectType === "general") {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => setProjectType(null)}
          className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-turk-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-turk-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">
            Turk of All Trades
          </h1>
        </div>
        <p className="text-slate-500 mb-8">
          Projects group related turks together so they can share context and coordinate.
        </p>

        <form onSubmit={handleGeneralSubmit} className="space-y-6">
          <div>
            <label className="label">Project Name</label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g., Client Portal QA, E-commerce Checkout"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="textarea w-full h-24"
              placeholder="What is this project about? What site or feature are the turks testing?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Objective (optional)</label>
            <textarea
              className="textarea w-full h-24"
              placeholder="What is the end goal of this project?"
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
            />
            <p className="text-slate-400 text-xs mt-1">
              The objective is shared with all turks in this project to guide their work.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setProjectType(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Step 2b: Investor project form
  return (
    <div className="max-w-2xl">
      <button
        onClick={() => setProjectType(null)}
        className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-800">
          The Turk Investor
        </h1>
      </div>
      <p className="text-slate-500 mb-8">
        Search for a stock symbol to start building an investment research project with specialized AI turks.
      </p>

      <div className="space-y-6">
        <div ref={wrapperRef} className="relative">
          <label className="label">Stock Symbol</label>
          <div className="relative">
            <input
              type="text"
              className="input w-full pr-10"
              placeholder="Search by ticker or company name... e.g. MSFT, Apple"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selected) setSelected(null);
              }}
              onFocus={() => {
                if (results.length > 0 && !selected) setShowDropdown(true);
              }}
            />
            {tickerLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-turk-500 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto">
              {results.map((r) => (
                <button
                  key={`${r.ticker}-${r.exchange}`}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                  onClick={() => handleSelectTicker(r)}
                >
                  <div>
                    <span className="font-semibold text-slate-800">{r.ticker}</span>
                    <span className="text-slate-400 ml-2 text-sm">{r.name}</span>
                  </div>
                  <span className="text-slate-400 text-xs">{r.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="card bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <span className="text-amber-700 font-bold">{selected.ticker}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{selected.name}</h3>
                  <p className="text-slate-500 text-sm">
                    {selected.exchange} &middot; {selected.ticker}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearTicker}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                Change
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleInvestorCreate}
            className="btn-primary"
            disabled={!selected || creating}
          >
            {creating ? "Creating..." : "Create Research Project"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setProjectType(null)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
