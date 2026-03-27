"use client";

import { useState, useEffect } from "react";

type Group = { id: string; name: string; _count: { fields: number } };

export function CredentialPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-gray-600 text-sm">
        No credential groups yet.{" "}
        <a href="/credentials" className="text-turk-400 underline">
          Create one first
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <label
          key={g.id}
          className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-750"
        >
          <input
            type="checkbox"
            checked={selected.includes(g.id)}
            onChange={() => toggle(g.id)}
            className="rounded border-gray-600"
          />
          <div>
            <p className="text-gray-200 text-sm font-medium">{g.name}</p>
            <p className="text-gray-500 text-xs">{g._count.fields} fields</p>
          </div>
        </label>
      ))}
    </div>
  );
}
