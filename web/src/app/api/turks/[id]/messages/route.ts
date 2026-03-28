import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const take = parseInt(url.searchParams.get("take") || "50");
  const cursor = url.searchParams.get("cursor");
  const after = url.searchParams.get("after");

  // Incremental fetch: get messages newer than the given timestamp
  if (after) {
    const messages = await prisma.message.findMany({
      where: {
        turkId: params.id,
        createdAt: { gt: new Date(after) },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  }

  const messages = await prisma.message.findMany({
    where: { turkId: params.id },
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return NextResponse.json(messages);
}
