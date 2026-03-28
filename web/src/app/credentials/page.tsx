"use client";

import { useState, useEffect } from "react";

type Field = { id: string; key: string; value: string; isSecret: boolean };
type Group = { id: string; name: string; fields: Field[] };

export default function CredentialsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formFields, setFormFields] = useState<
    { key: string; value: string; isSecret: boolean }[]
  >([{ key: "", value: "", isSecret: false }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    const res = await fetch("/api/credentials?includeFields=true");
    const data = await res.json();
    setGroups(data);
  }

  function addField() {
    setFormFields([...formFields, { key: "", value: "", isSecret: false }]);
  }

  function removeField(index: number) {
    setFormFields(formFields.filter((_, i) => i !== index));
  }

  function updateField(
    index: number,
    updates: Partial<{ key: string; value: string; isSecret: boolean }>
  ) {
    setFormFields(
      formFields.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || formFields.some((f) => !f.key.trim())) return;

    setLoading(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, fields: formFields }),
      });
      if (!res.ok) throw new Error("Failed");
      setShowForm(false);
      setFormName("");
      setFormFields([{ key: "", value: "", isSecret: false }]);
      loadGroups();
    } catch {
      alert("Failed to create credential group");
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm("Delete this credential group?")) return;
    const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete credential group");
      return;
    }
    loadGroups();
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Credentials</h1>
          <p className="text-slate-500 mt-1">
            Manage login credentials for your turks
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add Credentials
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Group Name</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g., Client 1 Login"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Fields</label>
              <div className="space-y-3">
                {formFields.map((field, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="Field name (e.g., Username)"
                      value={field.key}
                      onChange={(e) => updateField(i, { key: e.target.value })}
                      required
                    />
                    <input
                      type={field.isSecret ? "password" : "text"}
                      className="input flex-1"
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) =>
                        updateField(i, { value: e.target.value })
                      }
                    />
                    <label className="flex items-center gap-1 text-slate-500 text-xs whitespace-nowrap pt-2">
                      <input
                        type="checkbox"
                        checked={field.isSecret}
                        onChange={(e) =>
                          updateField(i, { isSecret: e.target.checked })
                        }
                      />
                      Secret
                    </label>
                    {formFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeField(i)}
                        className="text-red-500 hover:text-red-600 pt-2 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addField}
                className="text-turk-600 text-sm mt-2 hover:text-turk-700"
              >
                + Add Field
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {groups.length === 0 && !showForm ? (
        <div className="card text-center py-12">
          <p className="text-slate-500 mb-4">No credentials yet</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Add your first credentials
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-800 font-semibold">{group.name}</h3>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-red-500 hover:text-red-600 text-sm"
                >
                  Delete
                </button>
              </div>
              <div className="space-y-2">
                {group.fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 bg-slate-50 rounded px-3 py-2"
                  >
                    <span className="text-slate-500 text-sm font-medium min-w-[120px]">
                      {field.key}
                    </span>
                    <span className="text-slate-700 text-sm">
                      {field.isSecret ? "••••••••" : field.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
