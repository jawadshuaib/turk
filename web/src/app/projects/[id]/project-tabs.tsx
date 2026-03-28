"use client";

import { useState, ReactNode } from "react";
import { MemoryBank } from "@/components/memory-bank";

export function ProjectTabs({
  projectId,
  memoryEntryCount,
  hasRunningTurks,
  turksContent,
}: {
  projectId: string;
  memoryEntryCount: number;
  hasRunningTurks: boolean;
  turksContent: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"turks" | "memory">("turks");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        <button
          className={`text-sm font-medium px-4 py-2 border-b-2 transition-colors ${
            activeTab === "turks"
              ? "border-turk-600 text-turk-700"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
          onClick={() => setActiveTab("turks")}
        >
          Turks
        </button>
        <button
          className={`text-sm font-medium px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "memory"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
          onClick={() => setActiveTab("memory")}
        >
          Memory Bank
          {memoryEntryCount > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === "memory"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {memoryEntryCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "turks" && turksContent}
      {activeTab === "memory" && (
        <MemoryBank
          projectId={projectId}
          hasRunningTurks={hasRunningTurks}
        />
      )}
    </div>
  );
}
