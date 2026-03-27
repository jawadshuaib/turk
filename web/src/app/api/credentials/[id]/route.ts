import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check if any turks are using this credential group
  const usageCount = await prisma.turkCredential.count({
    where: { groupId: params.id },
  });

  if (usageCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: this credential group is used by ${usageCount} turk(s). Remove it from those turks first.`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.credentialGroup.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Credential group not found" },
      { status: 404 }
    );
  }
}
