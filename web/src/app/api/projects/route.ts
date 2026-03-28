import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { turks: true, memoryEntries: true } },
      turks: {
        select: { status: true },
      },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, objective } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || "",
      objective: objective?.trim() || "",
    },
  });

  return NextResponse.json(project, { status: 201 });
}
