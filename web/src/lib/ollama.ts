import { prisma } from "@/lib/db";
import { decryptValue } from "@/lib/encryption";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_CLOUD_URL = "https://api.ollama.com";

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

// ─── API Key (DB first, then env fallback) ───────────────

export async function getApiKey(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "OLLAMA_API_KEY" },
    });
    if (setting) {
      return decryptValue(setting.value);
    }
  } catch {
    // DB or decryption error — fall through to env
  }
  return process.env.OLLAMA_API_KEY || "";
}

export async function hasCloudApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key.length > 0;
}

// ─── Local Ollama ────────────────────────────────────────

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

// ─── Ollama Cloud ────────────────────────────────────────

export async function listCloudModels(): Promise<OllamaModel[]> {
  const apiKey = await getApiKey();
  if (!apiKey) return [];
  try {
    const res = await fetch(`${OLLAMA_CLOUD_URL}/api/tags`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
}

export async function checkCloudHealth(): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) return false;
  try {
    const res = await fetch(`${OLLAMA_CLOUD_URL}/api/tags`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getCloudBaseUrl(): string {
  return OLLAMA_CLOUD_URL;
}
