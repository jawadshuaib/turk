import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
  const format = req.nextUrl.searchParams.get("format") || "markdown";

  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const entries = await prisma.memoryEntry.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
    include: {
      turk: { select: { id: true, name: true } },
    },
  });

  if (format === "json") {
    return NextResponse.json(entries);
  }

  // Markdown export — grouped by category
  const grouped: Record<string, typeof entries> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) {
      grouped[entry.category] = [];
    }
    grouped[entry.category].push(entry);
  }

  let markdown = `# Research Report: ${project.name}\n\n`;

  if (project.objective) {
    markdown += `## Objective\n${project.objective}\n\n`;
  }

  markdown += `## Data Collected\n\n`;
  markdown += `*${entries.length} entries from ${new Set(entries.map((e) => e.turkId).filter(Boolean)).size} turks across ${Object.keys(grouped).length} categories*\n\n`;

  for (const [category, categoryEntries] of Object.entries(grouped)) {
    markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ")}\n\n`;

    for (const entry of categoryEntries) {
      markdown += `#### ${entry.title}\n`;
      if (entry.sourceUrl) {
        markdown += `Source: ${entry.sourceUrl}\n`;
      }
      if (entry.turk) {
        markdown += `Contributed by: ${entry.turk.name}\n`;
      }
      markdown += `\n${entry.content}\n\n---\n\n`;
    }
  }

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
  } catch (err) {
    console.error("[Export] Error:", err);
    return NextResponse.json(
      { error: "Failed to export memory entries" },
      { status: 500 }
    );
  }
}
