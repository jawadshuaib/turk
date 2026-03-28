"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", objective: "" });

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">
        Create New Project
      </h1>
      <p className="text-slate-500 mb-8">
        Projects group related turks together so they can share context and
        coordinate.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
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
            placeholder="What is the end goal of this project? e.g., Research MSFT stock by gathering news, analyst reports, valuation data, and risk factors from multiple sources."
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
          />
          <p className="text-slate-400 text-xs mt-1">
            The objective is shared with all turks in this project to guide their research focus.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create Project"}
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
