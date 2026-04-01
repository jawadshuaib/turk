import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startTurkContainer } from "@/lib/docker";
import { decryptValue } from "@/lib/encryption";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const turk = await prisma.turk.findUnique({
    where: { id: params.id },
    include: {
      credentials: { include: { group: { include: { fields: true } } } },
    },
  });

  if (!turk) {
    return NextResponse.json({ error: "Turk not found" }, { status: 404 });
  }

  if (turk.status === "running" || turk.status === "starting") {
    return NextResponse.json(
      { error: "Turk is already running" },
      { status: 400 }
    );
  }

  if (!turk.ollamaModel.trim()) {
    return NextResponse.json(
      { error: "Turk has no model configured" },
      { status: 400 }
    );
  }

  // Decrypt credentials for the agent
  const credentials: Record<string, Record<string, string>> = {};
  for (const tc of turk.credentials) {
    const group: Record<string, string> = {};
    for (const field of tc.group.fields) {
      try {
        group[field.key] = decryptValue(field.value);
      } catch {
        group[field.key] = field.value; // fallback if not encrypted
      }
    }
    credentials[tc.group.name] = group;
  }

  // Fetch project objective if turk belongs to a project
  let projectObjective = "";
  if (turk.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: turk.projectId },
      select: { objective: true },
    });
    projectObjective = project?.objective || "";
  }

  // Fetch memory entries if turk has memoryInputCategories in metadata
  let memoryEntries: Array<{ category: string; title: string; content: string; sourceUrl: string | null }> = [];
  const turkMeta = turk.metadata as Record<string, unknown> | null;
  const memoryCategories = (turkMeta?.memoryInputCategories as string[]) || [];
  if (turk.projectId && memoryCategories.length > 0) {
    memoryEntries = await prisma.memoryEntry.findMany({
      where: {
        projectId: turk.projectId,
        category: { in: memoryCategories },
      },
      select: {
        category: true,
        title: true,
        content: true,
        sourceUrl: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  try {
    await prisma.turk.update({
      where: { id: turk.id },
      data: { status: "starting" },
    });

    const containerId = await startTurkContainer({
      turkId: turk.id,
      targetUrl: turk.targetUrl,
      instructions: turk.instructions,
      ollamaModel: turk.ollamaModel,
      modelSource: turk.modelSource,
      credentials,
      projectObjective,
      turkRole: turk.role,
      memoryEntries,
    });

    await prisma.turk.update({
      where: { id: turk.id },
      data: { status: "running", containerId },
    });

    // Create a task run
    await prisma.taskRun.create({
      data: { turkId: turk.id, status: "running" },
    });

    // Auto-set project status to in_progress when first turk starts
    if (turk.projectId) {
      await prisma.project.updateMany({
        where: { id: turk.projectId, status: "draft" },
        data: { status: "in_progress" },
      });
    }

    return NextResponse.json({ containerId });
  } catch (err) {
    await prisma.turk.update({
      where: { id: turk.id },
      data: { status: "error" },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start" },
      { status: 500 }
    );
  }
}
