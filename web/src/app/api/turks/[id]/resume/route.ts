import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const turk = await prisma.turk.findUnique({ where: { id: params.id } });

  if (!turk) {
    return NextResponse.json({ error: "Turk not found" }, { status: 404 });
  }

  if (turk.status !== "paused") {
    return NextResponse.json(
      { error: "Turk is not paused" },
      { status: 400 }
    );
  }

  await prisma.turk.update({
    where: { id: turk.id },
    data: { status: "running" },
  });

  return NextResponse.json({ ok: true });
}
