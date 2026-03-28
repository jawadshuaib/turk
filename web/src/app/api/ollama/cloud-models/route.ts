import { NextResponse } from "next/server";
import { hasCloudApiKey, getApiKey } from "@/lib/ollama";

export const dynamic = "force-dynamic";

const OLLAMA_CLOUD_URL = "https://api.ollama.com";

export async function GET() {
  const hasKey = await hasCloudApiKey();
  if (!hasKey) {
    return NextResponse.json(
      { error: "No OLLAMA_API_KEY configured", models: [], hasKey: false },
      { status: 200 }
    );
  }

  const apiKey = await getApiKey();
  try {
    const res = await fetch(`${OLLAMA_CLOUD_URL}/api/tags`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        models: [],
        hasKey: true,
        authError: true,
        error: "API key is invalid or expired",
      });
    }

    if (!res.ok) {
      return NextResponse.json({
        models: [],
        hasKey: true,
        error: `Ollama Cloud returned ${res.status}`,
      });
    }

    const data = await res.json();
    return NextResponse.json({ models: data.models || [], hasKey: true });
  } catch {
    return NextResponse.json({
      models: [],
      hasKey: true,
      error: "Could not reach Ollama Cloud",
    });
  }
}
