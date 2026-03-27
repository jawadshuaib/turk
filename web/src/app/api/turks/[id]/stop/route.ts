import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stopTurkContainer } from "@/lib/docker";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const turk = await prisma.turk.findUnique({ where: { id: params.id } });

  if (!turk) {
    return NextResponse.json({ error: "Turk not found" }, { status: 404 });
  }

  if (turk.containerId) {
    try {
      await stopTurkContainer(turk.containerId);
    } catch {
      // container may already be stopped
    }
  }

  await prisma.turk.update({
    where: { id: turk.id },
    data: { status: "stopped", containerId: null },
  });

  // Complete any running task runs with step count
  const runningRuns = await prisma.taskRun.findMany({
    where: { turkId: turk.id, status: "running" },
    include: { _count: { select: { steps: true } } },
  });
  for (const run of runningRuns) {
    await prisma.taskRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        summary: `Stopped by user after ${run._count.steps} steps`,
        completedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
