import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const take = parseInt(url.searchParams.get("take") || "50");
  const cursor = url.searchParams.get("cursor");

  const messages = await prisma.message.findMany({
    where: { turkId: params.id },
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return NextResponse.json(messages);
}
