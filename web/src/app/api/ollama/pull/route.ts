import { NextRequest, NextResponse } from "next/server";
import { pullModel } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { model } = await req.json();
  if (!model || typeof model !== "string") {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  try {
    const stream = await pullModel(model.trim());
    if (!stream) {
      return NextResponse.json(
        { error: "No response from Ollama" },
        { status: 502 }
      );
    }

    // Stream the pull progress back to the client
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pull failed" },
      { status: 500 }
    );
  }
}
