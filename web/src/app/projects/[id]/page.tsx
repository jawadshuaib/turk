import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { TurkAvatar } from "@/components/turk-avatar";
import { ProjectActions } from "@/components/project-actions";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      turks: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { messages: true, taskRuns: true } },
        },
      },
    },
  });

  if (!project) return notFound();

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
          <h1 className="text-3xl font-bold text-slate-800">{project.name}</h1>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
      </div>

      {/* Turks list */}
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
                    <p className="text-slate-400 text-sm truncate">
                      {turk.targetUrl}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-400 ml-6">
                    <p>{turk._count.taskRuns} runs</p>
                    <p>{turk._count.messages} messages</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
