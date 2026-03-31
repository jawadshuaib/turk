import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const investorProject = await prisma.investorProject.findUnique({
    where: { projectId: params.id },
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
