import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { TurkAvatar } from "@/components/turk-avatar";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const turks = await prisma.turk.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const stats = {
    total: await prisma.turk.count(),
    running: await prisma.turk.count({ where: { status: "running" } }),
    bugs: await prisma.message.count({
      where: {
        role: "agent",
        metadata: { path: ["kind"], equals: "bug_report" },
      },
    }),
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your AI employees</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-gray-400 text-sm">Total Turks</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Currently Running</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {stats.running}
          </p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Bugs Found</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{stats.bugs}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Recent Turks</h2>
        <Link href="/turks/new" className="btn-primary">
          + New Turk
        </Link>
      </div>

      {turks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">
            No turks created yet. Create your first AI employee!
          </p>
          <Link href="/turks/new" className="btn-primary">
            Create Turk
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {turks.map((turk) => (
            <Link key={turk.id} href={`/turks/${turk.id}`} className="block">
              <div className="card hover:border-turk-600 transition-colors cursor-pointer flex items-center gap-4">
                <TurkAvatar avatar={turk.avatar} name={turk.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium">{turk.name}</h3>
                  <p className="text-gray-500 text-sm truncate">{turk.targetUrl}</p>
                </div>
                <StatusBadge status={turk.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
