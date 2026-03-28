import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { TurkAvatar } from "@/components/turk-avatar";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const turks = await prisma.turk.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      _count: { select: { turks: true } },
      turks: { select: { status: true } },
    },
  });

  const stats = {
    projects: await prisma.project.count(),
    total: await prisma.turk.count(),
    running: await prisma.turk.count({ where: { status: "running" } }),
    bugs: await prisma.message.count({
      where: {
        role: "agent",
        metadata: { path: ["kind"], equals: "bug_report" },
      },
    }),
  };

  const hasData = stats.total > 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero / Splash Section */}
      <div className="card mb-8 overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-8 p-2">
          <div className="shrink-0">
            <Image
              src="/avatars/turk-1.png"
              alt="Meet your Turk"
              width={160}
              height={160}
              className="rounded-2xl shadow-md"
            />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Welcome to <span className="text-turk-600">Turk</span>
            </h1>
            <p className="text-slate-600 text-base leading-relaxed mb-4">
              Turk turns{" "}
              <a
                href="https://openclaw.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-turk-600 hover:text-turk-700 font-medium underline decoration-turk-300"
              >
                OpenClaw
              </a>{" "}
              AI agents into managed employees you can hire, direct, and
              supervise from one dashboard. Each turk runs in its own isolated
              container with a real browser, persistent memory, and encrypted
              credentials.
            </p>
            <div className="space-y-2 text-sm text-slate-500">
              <div className="flex items-start gap-2">
                <span className="text-turk-500 mt-0.5">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span>
                  <strong className="text-slate-700">
                    One dashboard, many agents
                  </strong>{" "}
                  &mdash; start, pause, resume, and stop turks without touching
                  the CLI. Send mid-test instructions and watch results stream
                  live.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-turk-500 mt-0.5">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span>
                  <strong className="text-slate-700">
                    Isolated and secure
                  </strong>{" "}
                  &mdash; each turk gets its own Docker container, browser, and
                  memory volume. Credentials are AES-256 encrypted at rest.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-turk-500 mt-0.5">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span>
                  <strong className="text-slate-700">
                    Agents that learn
                  </strong>{" "}
                  &mdash; persistent memory means turks remember past findings
                  across runs. They get smarter at testing your app over time.
                </span>
              </div>
            </div>
            {!hasData && (
              <div className="mt-6">
                <Link href="/turks/new" className="btn-primary inline-flex items-center gap-2">
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
                  Hire your first Turk
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-violet-600"
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
            <p className="text-sm text-slate-500">Projects</p>
            <p className="text-2xl font-bold text-slate-800">
              {stats.projects}
            </p>
          </div>
        </div>
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
            <p className="text-sm text-slate-500">Total Turks</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
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
            <p className="text-sm text-slate-500">Currently Running</p>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.running}
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
            <p className="text-2xl font-bold text-red-500">{stats.bugs}</p>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-800">
              Recent Projects
            </h2>
            <Link
              href="/projects"
              className="text-turk-600 hover:text-turk-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const runningCount = project.turks.filter(
                (t) => t.status === "running"
              ).length;
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="card hover:border-turk-400 hover:shadow-md transition-all cursor-pointer h-full">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-turk-50 flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          className="w-4 h-4 text-turk-600"
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
                      <div className="min-w-0">
                        <h3 className="text-slate-800 font-medium truncate">
                          {project.name}
                        </h3>
                        <p className="text-slate-400 text-sm">
                          {project._count.turks} turk
                          {project._count.turks !== 1 ? "s" : ""}
                          {runningCount > 0 && (
                            <span className="text-emerald-600 ml-2">
                              {runningCount} running
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Turks */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Recent Turks</h2>
        <Link href="/turks/new" className="btn-primary inline-flex items-center gap-1.5 text-sm">
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
          New Turk
        </Link>
      </div>

      {turks.length === 0 ? (
        <div className="card text-center py-12">
          <div className="mb-4">
            <Image
              src="/avatars/turk-3.png"
              alt="No turks yet"
              width={80}
              height={80}
              className="rounded-full mx-auto opacity-60"
            />
          </div>
          <p className="text-slate-500 mb-4">
            No turks created yet. Hire your first AI employee!
          </p>
          <Link href="/turks/new" className="btn-primary">
            Create Turk
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {turks.map((turk) => (
            <Link key={turk.id} href={`/turks/${turk.id}`} className="block">
              <div className="card hover:border-turk-400 hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
                <TurkAvatar avatar={turk.avatar} name={turk.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-slate-800 font-medium">{turk.name}</h3>
                    {turk.project && (
                      <span className="text-xs bg-turk-50 text-turk-700 px-2 py-0.5 rounded">
                        {turk.project.name}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm truncate">
                    {turk.targetUrl}
                  </p>
                </div>
                <StatusBadge status={turk.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* How It Works Section */}
      <div className="mt-12 mb-4">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">
          How Turk works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card text-center">
            <div className="w-12 h-12 rounded-full bg-turk-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-turk-600 font-bold text-lg">1</span>
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              Create a Turk
            </h3>
            <p className="text-sm text-slate-500">
              Give it a name, a target URL, and plain-English instructions
              describing what to test. Attach credentials if it needs to log in.
            </p>
          </div>
          <div className="card text-center">
            <div className="w-12 h-12 rounded-full bg-turk-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-turk-600 font-bold text-lg">2</span>
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              It tests autonomously
            </h3>
            <p className="text-sm text-slate-500">
              Turk spins up an isolated container with a real browser and an
              OpenClaw AI agent. It navigates, clicks, fills forms, and hunts
              for bugs on its own.
            </p>
          </div>
          <div className="card text-center">
            <div className="w-12 h-12 rounded-full bg-turk-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-turk-600 font-bold text-lg">3</span>
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              Review findings
            </h3>
            <p className="text-sm text-slate-500">
              Watch the activity stream live, review bugs sorted by severity,
              and export them as a prompt for Claude Code to fix automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Why Turk vs. raw OpenClaw */}
      <div className="mt-8 card bg-gradient-to-br from-turk-50 to-white border-turk-200">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="shrink-0 hidden md:block">
            <Image
              src="/avatars/turk-5.png"
              alt="Turk vs OpenClaw"
              width={100}
              height={100}
              className="rounded-xl"
            />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">
              Why not just run OpenClaw directly?
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              OpenClaw is the powerful AI engine under the hood. Turk is the
              management layer on top. Think of it this way: OpenClaw is the
              worker; Turk is the HR department.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-turk-500 text-xs">&#9679;</span>
                Web UI vs. CLI &mdash; no terminal needed
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-turk-500 text-xs">&#9679;</span>
                Manage multiple agents from one place
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-turk-500 text-xs">&#9679;</span>
                Encrypted credential vault, shared securely
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-turk-500 text-xs">&#9679;</span>
                Live WebSocket streaming of results
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-turk-500 text-xs">&#9679;</span>
                Persistent memory &mdash; agents learn over time
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-turk-500 text-xs">&#9679;</span>
                One-click export to Claude Code for fixes
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
