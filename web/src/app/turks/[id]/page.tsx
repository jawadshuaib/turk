import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { TurkControls } from "@/components/turk-controls";
import { TurkChat } from "@/components/turk-chat";
import { TurkInstructions } from "@/components/turk-instructions";
import { TurkAvatar } from "@/components/turk-avatar";

export const dynamic = "force-dynamic";

export default async function TurkDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const turk = await prisma.turk.findUnique({
    where: { id: params.id },
    include: {
      credentials: { include: { group: { include: { fields: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 50 },
      taskRuns: {
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { steps: { orderBy: { createdAt: "desc" }, take: 10 } },
      },
    },
  });

  if (!turk) return notFound();

  const messages = [...turk.messages].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <TurkAvatar avatar={turk.avatar} name={turk.name} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-white">{turk.name}</h1>
            <p className="text-gray-500 text-sm">{turk.targetUrl}</p>
          </div>
        </div>
        <TurkControls turkId={turk.id} status={turk.status} />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Chat / Activity */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <TurkChat
            turkId={turk.id}
            initialMessages={messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              metadata: m.metadata as Record<string, unknown> | null,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Instructions */}
          <TurkInstructions
            turkId={turk.id}
            initialInstructions={turk.instructions}
            targetUrl={turk.targetUrl}
          />

          {/* Credentials */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Credentials
            </h3>
            {turk.credentials.length === 0 ? (
              <p className="text-gray-600 text-sm">None attached</p>
            ) : (
              <div className="space-y-2">
                {turk.credentials.map((tc) => (
                  <div
                    key={tc.groupId}
                    className="bg-gray-800 rounded px-3 py-2"
                  >
                    <p className="text-gray-300 text-sm font-medium">
                      {tc.group.name}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {tc.group.fields.length} fields
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Runs */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Recent Runs
            </h3>
            {turk.taskRuns.length === 0 ? (
              <p className="text-gray-600 text-sm">No runs yet</p>
            ) : (
              <div className="space-y-2">
                {turk.taskRuns.map((run) => (
                  <div
                    key={run.id}
                    className="bg-gray-800 rounded px-3 py-2 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-gray-300 text-sm">
                        {run.status === "running" ? "Running..." : run.summary || "No summary"}
                      </p>
                      <p className="text-gray-600 text-xs">
                        {run.steps.length} steps
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        run.status === "completed"
                          ? "bg-green-900 text-green-300"
                          : run.status === "failed"
                            ? "bg-red-900 text-red-300"
                            : "bg-yellow-900 text-yellow-300"
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Config */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Config</h3>
            <div className="text-sm space-y-1">
              <p className="text-gray-500">
                Model:{" "}
                <span className="text-gray-300">{turk.ollamaModel}</span>
              </p>
              <p className="text-gray-500">
                Type: <span className="text-gray-300">{turk.type}</span>
              </p>
              <p className="text-gray-500">
                Created:{" "}
                <span className="text-gray-300">
                  {turk.createdAt.toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
