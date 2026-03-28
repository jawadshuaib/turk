import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { turks: true } },
      turks: { select: { status: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Projects</h1>
          <p className="text-slate-500 mt-1">
            Organize your turks into projects
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
            Projects let you group related turks together.
          </p>
          <Link href="/projects/new" className="btn-primary">
            Create your first Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const runningCount = project.turks.filter(
              (t) => t.status === "running"
            ).length;
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="card hover:border-turk-400 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
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
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-slate-800 font-semibold text-lg">
                            {project.name}
                          </h3>
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
