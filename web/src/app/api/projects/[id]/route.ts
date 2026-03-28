import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      turks: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { messages: true, taskRuns: true } } },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const trimmed = String(body.name).trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "name cannot be empty" },
        { status: 400 }
      );
    }
    data.name = trimmed;
  }
  if (body.description !== undefined) data.description = String(body.description).trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Prevent deletion if any turks are running
    const runningCount = await prisma.turk.count({
      where: { projectId: params.id, status: "running" },
    });
    if (runningCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete project with ${runningCount} running turk(s). Stop them first.` },
        { status: 400 }
      );
    }

    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
}
