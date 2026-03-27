import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const turks = await prisma.turk.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true, taskRuns: true } } },
  });
  return NextResponse.json(turks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, targetUrl, instructions, ollamaModel, credentialGroupIds } =
    body;

  if (!name || !targetUrl || !instructions) {
    return NextResponse.json(
      { error: "name, targetUrl, and instructions are required" },
      { status: 400 }
    );
  }

  const AVATARS = ["turk-1.png", "turk-2.png", "turk-3.png", "turk-4.png", "turk-5.png", "turk-6.png"];
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

  const turk = await prisma.turk.create({
    data: {
      name,
      targetUrl,
      instructions,
      ollamaModel: ollamaModel || "llama3",
      avatar,
      type: "testing-agent",
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
