import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const turks = await prisma.turk.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { messages: true, taskRuns: true } },
    },
  });
  return NextResponse.json(turks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, targetUrl, instructions, ollamaModel, modelSource, credentialGroupIds, projectId, role } =
    body;

  if (!name || !targetUrl || !instructions) {
    return NextResponse.json(
      { error: "name, targetUrl, and instructions are required" },
      { status: 400 }
    );
  }

  // Validate projectId exists if provided
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 400 }
      );
    }
  }

  const AVATARS = ["turk-1.png", "turk-2.png", "turk-3.png", "turk-4.png", "turk-5.png", "turk-6.png"];
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

  const turk = await prisma.turk.create({
    data: {
      name,
      targetUrl,
      instructions,
      ollamaModel: ollamaModel || "llama3.1:8b",
      modelSource: modelSource === "cloud" ? "cloud" : "local",
      role: role?.trim() || "",
      avatar,
      type: "testing-agent",
      projectId: projectId || null,
      credentials: credentialGroupIds?.length
        ? {
            create: credentialGroupIds.map((groupId: string) => ({
              groupId,
            })),
          }
        : undefined,
    },
  });

  return NextResponse.json(turk, { status: 201 });
}
