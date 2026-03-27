import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getContainerLogs } from "@/lib/docker";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const turk = await prisma.turk.findUnique({ where: { id: params.id } });

  if (!turk) {
    return NextResponse.json({ error: "Turk not found" }, { status: 404 });
  }

  if (!turk.containerId) {
    return NextResponse.json({ logs: "", running: false });
  }

  const url = new URL(req.url);
  const tail = parseInt(url.searchParams.get("tail") || "100");

  const logs = await getContainerLogs(turk.containerId, tail);
  return NextResponse.json({ logs, running: turk.status === "running" });
}
