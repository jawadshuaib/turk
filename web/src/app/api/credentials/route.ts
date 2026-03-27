import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptValue } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const includeFields = url.searchParams.get("includeFields") === "true";

  const groups = await prisma.credentialGroup.findMany({
    orderBy: { createdAt: "desc" },
    include: includeFields
      ? { fields: true }
      : { _count: { select: { fields: true } } },
  });

  // Mask secret values if fields are included
  if (includeFields) {
    for (const group of groups as Array<{
      fields: Array<{ isSecret: boolean; value: string }>;
    }>) {
      for (const field of group.fields) {
        if (field.isSecret) {
          field.value = "••••••••";
        }
      }
    }
  }

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, fields } = body;

  if (!name || !fields?.length) {
    return NextResponse.json(
      { error: "name and fields are required" },
      { status: 400 }
    );
  }

  const group = await prisma.credentialGroup.create({
    data: {
      name,
      fields: {
        create: fields.map(
          (f: { key: string; value: string; isSecret: boolean }) => ({
            key: f.key,
            value: encryptValue(f.value),
            isSecret: f.isSecret ?? false,
          })
        ),
      },
    },
    include: { fields: true },
  });

  return NextResponse.json(group, { status: 201 });
}
