import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { turks: true, memoryEntries: true } },
      turks: { select: { status: true } },
      investorProject: true,
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Projects</h1>
          <p className="text-slate-500 mt-1">
            All your turk projects in one place
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-500 mb-2 text-lg">No projects yet</p>
          <p className="text-slate-400 text-sm mb-6">
            Create a project to get started — choose between a general-purpose turk project or a stock research project.
          </p>
          <Link href="/projects/new" className="btn-primary">
            Create your first Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const isInvestor = !!project.investorProject;
            const runningCount = project.turks.filter(
              (t) => t.status === "running"
            ).length;
            const statusColor: Record<string, string> = {
              draft: "bg-slate-100 text-slate-600",
              in_progress: "bg-amber-100 text-amber-700",
              completed: "bg-emerald-100 text-emerald-700",
            };
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className={`card hover:shadow-md transition-all cursor-pointer ${
                  isInvestor ? "hover:border-amber-400" : "hover:border-turk-400"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        {isInvestor ? (
                          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-amber-700 font-bold text-xs">
                              {project.investorProject!.ticker}
                            </span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-turk-50 flex items-center justify-center flex-shrink-0">
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
                                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-slate-800 font-semibold text-lg">
                              {project.name}
                            </h3>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                isInvestor
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-turk-50 text-turk-700"
                              }`}
                            >
                              {isInvestor ? "Investor" : "General"}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                statusColor[project.status] || statusColor.draft
                              }`}
                            >
                              {project.status.replace("_", " ")}
                            </span>
                          </div>
                          {project.description && (
                            <p className="text-slate-400 text-sm mt-0.5 line-clamp-1">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-6">
                      <div className="text-right text-sm">
                        <p className="text-slate-700 font-medium">
                          {project._count.turks} turk
                          {project._count.turks !== 1 ? "s" : ""}
                        </p>
                        {runningCount > 0 && (
                          <p className="text-emerald-600 text-xs flex items-center justify-end gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            {runningCount} running
                          </p>
                        )}
                        {project._count.memoryEntries > 0 && (
                          <p className="text-indigo-500 text-xs">
                            {project._count.memoryEntries} entries
                          </p>
                        )}
                      </div>
                      <svg
                        className="w-5 h-5 text-slate-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
