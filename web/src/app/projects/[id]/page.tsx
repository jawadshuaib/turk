import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { TurkAvatar } from "@/components/turk-avatar";
import { ProjectActions } from "@/components/project-actions";
import { ProjectTabs } from "./project-tabs";
import { InvestorProjectView } from "./investor-project-view";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { memoryEntries: true } },
      investorProject: true,
      turks: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { messages: true, taskRuns: true, memoryEntries: true } },
        },
      },
    },
  });

  if (!project) return notFound();

  const isInvestor = !!project.investorProject;

  // For investor projects, render the investor-specific view
  if (isInvestor) {
    return (
      <InvestorProjectView
        projectId={project.id}
        ticker={project.investorProject!.ticker}
        companyName={project.investorProject!.companyName}
        exchange={project.investorProject!.exchange}
      />
    );
  }

  // General project view
  const runningCount = project.turks.filter(
    (t) => t.status === "running"
  ).length;
  const bugCount = await prisma.message.count({
    where: {
      turkId: { in: project.turks.map((t) => t.id) },
      role: "agent",
      metadata: { path: ["kind"], equals: "bug_report" },
    },
  });

  const statusColor: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/projects"
              className="text-slate-400 hover:text-slate-600 text-sm"
            >
              Projects
            </Link>
            <span className="text-slate-300 text-sm">/</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-800">{project.name}</h1>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                statusColor[project.status] || statusColor.draft
              }`}
            >
              {project.status.replace("_", " ")}
            </span>
          </div>
          {project.description && (
            <p className="text-slate-500 mt-1">{project.description}</p>
          )}
        </div>
        <ProjectActions
          projectId={project.id}
          initialName={project.name}
          initialDescription={project.description}
        />
      </div>

      {/* Objective */}
      {project.objective && (
        <div className="card mb-6 border-indigo-200 bg-indigo-50/30">
          <h3 className="text-sm font-medium text-indigo-700 mb-1">Objective</h3>
          <p className="text-slate-700 text-sm whitespace-pre-wrap">{project.objective}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-turk-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-turk-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-500">Turks</p>
            <p className="text-2xl font-bold text-slate-800">
              {project.turks.length}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-500">Running</p>
            <p className="text-2xl font-bold text-emerald-600">
              {runningCount}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-500">Bugs Found</p>
            <p className="text-2xl font-bold text-red-500">{bugCount}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-500">Memory Entries</p>
            <p className="text-2xl font-bold text-indigo-600">
              {project._count.memoryEntries}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs: Turks | Memory Bank */}
      <ProjectTabs
        projectId={project.id}
        memoryEntryCount={project._count.memoryEntries}
        hasRunningTurks={runningCount > 0}
        turksContent={
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Turks</h2>
              <Link
                href={`/turks/new?projectId=${project.id}`}
                className="btn-primary inline-flex items-center gap-1.5 text-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Turk
              </Link>
            </div>

            {project.turks.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-slate-500 mb-4">
                  No turks in this project yet. Add your first one!
                </p>
                <Link
                  href={`/turks/new?projectId=${project.id}`}
                  className="btn-primary"
                >
                  Add Turk
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {project.turks.map((turk) => (
                  <Link key={turk.id} href={`/turks/${turk.id}`} className="block">
                    <div className="card hover:border-turk-400 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex items-center gap-4">
                        <TurkAvatar
                          avatar={turk.avatar}
                          name={turk.name}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h3 className="text-slate-800 font-medium">
                              {turk.name}
                            </h3>
                            <StatusBadge status={turk.status} />
                          </div>
                          {turk.role && (
                            <p className="text-indigo-500 text-xs mt-0.5">
                              {turk.role}
                            </p>
                          )}
                          <p className="text-slate-400 text-sm truncate">
                            {turk.targetUrl}
                          </p>
                        </div>
                        <div className="text-right text-sm text-slate-400 ml-6">
                          <p>{turk._count.taskRuns} runs</p>
                          <p>{turk._count.messages} messages</p>
                          {turk._count.memoryEntries > 0 && (
                            <p className="text-indigo-500">
                              {turk._count.memoryEntries} memories
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
