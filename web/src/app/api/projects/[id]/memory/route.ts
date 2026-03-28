import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const category = req.nextUrl.searchParams.get("category");

  const where: Record<string, unknown> = { projectId: params.id };
  if (category) {
    where.category = category;
  }

  const entries = await prisma.memoryEntry.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      turk: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json(entries);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { category, title, content, sourceUrl } = body;

  if (!category?.trim() || !title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "category, title, and content are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const entry = await prisma.memoryEntry.create({
    data: {
      projectId: params.id,
      turkId: null,
      category: category.trim(),
      title: title.trim(),
      content: content.trim(),
      sourceUrl: sourceUrl?.trim() || null,
    },
    include: {
      turk: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { entryId } = body;

  if (!entryId) {
    return NextResponse.json(
      { error: "entryId is required" },
      { status: 400 }
    );
  }

  // Verify entry belongs to this project
  const entry = await prisma.memoryEntry.findUnique({
    where: { id: entryId },
  });
  if (!entry || entry.projectId !== params.id) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await prisma.memoryEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
