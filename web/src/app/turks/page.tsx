import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { TurkAvatar } from "@/components/turk-avatar";

export const dynamic = "force-dynamic";

export default async function TurksPage() {
  const turks = await prisma.turk.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { messages: true, taskRuns: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Turks</h1>
          <p className="text-slate-500 mt-1">Manage your AI employees</p>
        </div>
        <Link href="/turks/new" className="btn-primary">
          + New Turk
        </Link>
      </div>

      {turks.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-500 mb-4 text-lg">No turks yet</p>
          <Link href="/turks/new" className="btn-primary">
            Create your first Turk
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {turks.map((turk) => (
            <Link key={turk.id} href={`/turks/${turk.id}`}>
              <div className="card hover:border-turk-400 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <TurkAvatar avatar={turk.avatar} name={turk.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-slate-800 font-semibold text-lg">
                        {turk.name}
                      </h3>
                      <StatusBadge status={turk.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {turk.project && (
                        <span className="text-xs bg-turk-50 text-turk-700 px-2 py-0.5 rounded">
                          {turk.project.name}
                        </span>
                      )}
                      <p className="text-slate-400 text-sm truncate">
                        {turk.targetUrl}
                      </p>
                    </div>
                    <p className="text-slate-500 text-sm mt-2 line-clamp-2">
                      {turk.instructions}
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
