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
      credentials,
    });

    await prisma.turk.update({
      where: { id: turk.id },
      data: { status: "running", containerId },
    });

    // Create a task run
    await prisma.taskRun.create({
      data: { turkId: turk.id, status: "running" },
    });

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
