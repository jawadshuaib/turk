const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export async function listModels(): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pullModel(
  modelName: string
): Promise<ReadableStream<Uint8Array> | null> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName }),
  });
  if (!res.ok) {
    throw new Error(`Ollama pull failed: ${res.statusText}`);
  }
  return res.body;
}
