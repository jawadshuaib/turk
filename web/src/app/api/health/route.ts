import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkOllamaHealth } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {};

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Ollama
  checks.ollama = await checkOllamaHealth();

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks },
    { status: healthy ? 200 : 503 }
  );
}
