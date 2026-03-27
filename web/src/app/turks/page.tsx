import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { TurkAvatar } from "@/components/turk-avatar";

export const dynamic = "force-dynamic";

export default async function TurksPage() {
  const turks = await prisma.turk.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true, taskRuns: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Turks</h1>
          <p className="text-gray-400 mt-1">Manage your AI employees</p>
        </div>
        <Link href="/turks/new" className="btn-primary">
          + New Turk
        </Link>
      </div>

      {turks.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400 mb-4 text-lg">No turks yet</p>
          <Link href="/turks/new" className="btn-primary">
            Create your first Turk
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {turks.map((turk) => (
            <Link key={turk.id} href={`/turks/${turk.id}`}>
              <div className="card hover:border-turk-600 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <TurkAvatar avatar={turk.avatar} name={turk.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-semibold text-lg">
                        {turk.name}
                      </h3>
                      <StatusBadge status={turk.status} />
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      {turk.targetUrl}
                    </p>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                      {turk.instructions}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500 ml-6">
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
