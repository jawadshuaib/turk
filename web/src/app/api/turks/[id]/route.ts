import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const turk = await prisma.turk.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      credentials: { include: { group: { include: { fields: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!turk) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(turk);
}

// Only allow updating safe fields
const ALLOWED_PATCH_FIELDS = new Set([
  "name",
  "targetUrl",
  "instructions",
  "ollamaModel",
  "projectId",
  "modelSource",
  "role",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();

  // Filter to only allowed fields
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_PATCH_FIELDS.has(key)) {
      data[key] = body[key];
    }
  }

  // Sanitize modelSource to only valid values
  if ("modelSource" in data) {
    data.modelSource = data.modelSource === "cloud" ? "cloud" : "local";
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  try {
    const turk = await prisma.turk.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(turk);
  } catch {
    return NextResponse.json({ error: "Turk not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const turk = await prisma.turk.findUnique({ where: { id: params.id } });
  if (!turk) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Stop container if running
  if (turk.containerId) {
    try {
      const { stopTurkContainer } = await import("@/lib/docker");
      await stopTurkContainer(turk.containerId);
    } catch {
      // container may already be stopped
    }
  }

  await prisma.turk.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
