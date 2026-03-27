import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const findings = await prisma.message.findMany({
    where: {
      turkId: id,
      role: "agent",
      OR: [
        {
          metadata: {
            path: ["kind"],
            equals: "bug_report",
          },
        },
        {
          AND: [
            {
              metadata: {
                path: ["kind"],
                equals: "result",
              },
            },
            {
              metadata: {
                path: ["success"],
                equals: false,
              },
            },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json(findings);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();

  const { title, description, severity = "info" } = body;

  if (!title || !description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 }
    );
  }

  const content = `[${severity.toUpperCase()}] ${title}\n\n${description}`;

  const message = await prisma.message.create({
    data: {
      turkId: id,
      role: "system",
      content,
      metadata: {
        kind: "bug_report",
        severity,
        title,
        manual: true,
      },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
