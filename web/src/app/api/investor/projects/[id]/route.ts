import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const investorProject = await prisma.investorProject.findUnique({
    where: { id: params.id },
    include: {
      project: {
        include: {
          _count: { select: { turks: true, memoryEntries: true } },
          turks: {
            orderBy: { createdAt: "desc" },
            include: {
              _count: { select: { memoryEntries: true } },
            },
          },
          memoryEntries: {
            orderBy: { createdAt: "desc" },
            include: {
              turk: { select: { id: true, name: true, avatar: true } },
            },
          },
        },
      },
    },
  });

  if (!investorProject) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(investorProject);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ip = await prisma.investorProject.findUnique({
      where: { id: params.id },
      select: { projectId: true },
    });
    if (!ip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Deleting the project cascades to InvestorProject
    await prisma.project.delete({ where: { id: ip.projectId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
