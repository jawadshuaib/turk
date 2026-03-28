import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptValue, decryptValue } from "@/lib/encryption";

// Keys that should be encrypted at rest
const ENCRYPTED_KEYS = new Set(["OLLAMA_API_KEY"]);

// Keys that are allowed to be read/written via this API
const ALLOWED_KEYS = new Set(["OLLAMA_API_KEY"]);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (key) {
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }
    const setting = await prisma.setting.findUnique({ where: { key } });
    if (!setting) {
      return NextResponse.json({ key, hasValue: false });
    }
    // For encrypted keys, don't return the actual value — just confirm it exists
    if (ENCRYPTED_KEYS.has(key)) {
      try {
        const decrypted = decryptValue(setting.value);
        // Return masked version: first 4 chars + dots
        const masked =
          decrypted.length > 4
            ? "****..." + decrypted.slice(-4)
            : "****";
        return NextResponse.json({ key, hasValue: true, masked });
      } catch {
        return NextResponse.json({ key, hasValue: false });
      }
    }
    return NextResponse.json({ key, hasValue: true, value: setting.value });
  }

  // Return all allowed keys and whether they have values
  const settings = await prisma.setting.findMany({
    where: { key: { in: Array.from(ALLOWED_KEYS) } },
  });
  const result: Record<string, { hasValue: boolean; masked?: string }> = {};
  for (const k of ALLOWED_KEYS) {
    const s = settings.find((s) => s.key === k);
    if (s && ENCRYPTED_KEYS.has(k)) {
      try {
        const decrypted = decryptValue(s.value);
        const masked =
          decrypted.length > 4
            ? "****..." + decrypted.slice(-4)
            : "****";
        result[k] = { hasValue: true, masked };
      } catch {
        result[k] = { hasValue: false };
      }
    } else if (s) {
      result[k] = { hasValue: true };
    } else {
      result[k] = { hasValue: false };
    }
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { key, value } = body;

  if (!key || !ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (typeof value !== "string") {
    return NextResponse.json(
      { error: "Value must be a string" },
      { status: 400 }
    );
  }

  // Allow clearing a key
  if (value === "") {
    await prisma.setting.deleteMany({ where: { key } });
    return NextResponse.json({ key, hasValue: false });
  }

  const storedValue = ENCRYPTED_KEYS.has(key) ? encryptValue(value) : value;

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: storedValue },
    update: { value: storedValue },
  });

  const masked =
    value.length > 4
      ? "****..." + value.slice(-4)
      : "****";

  return NextResponse.json({ key, hasValue: true, masked });
}
