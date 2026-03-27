import { NextResponse } from "next/server";
import { listModels } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  const models = await listModels();
  return NextResponse.json(models);
}
