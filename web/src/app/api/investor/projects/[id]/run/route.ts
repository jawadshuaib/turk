import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getValuation,
  getCompanyProfile,
  getValuationPeers,
} from "@/lib/m4th-api";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = await prisma.investorProject.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!ip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { ticker, projectId } = ip;

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "in_progress" },
  });

  const results: { category: string; title: string; content: string; error?: boolean }[] = [];

  // Run all M4th API calls in parallel (only endpoints that work with just a symbol)
  const tasks = [
    {
      category: "company_profile",
      title: `${ticker} Company Profile`,
      fn: () => getCompanyProfile(ticker),
    },
    {
      category: "valuation",
      title: `${ticker} Valuation Summary`,
      fn: () => getValuation(ticker),
    },
    {
      category: "valuation",
      title: `${ticker} Peer Comparison`,
      fn: () => getValuationPeers(ticker),
    },
  ];

  const settled = await Promise.allSettled(tasks.map((t) => t.fn()));

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      results.push({
        category: task.category,
        title: task.title,
        content: JSON.stringify(result.value, null, 2),
      });
    } else {
      results.push({
        category: task.category,
        title: task.title,
        content: `Error: ${result.reason?.message || "Unknown error"}`,
        error: true,
      });
    }
  }

  // Save all results as MemoryEntry records
  const entries = await prisma.memoryEntry.createMany({
    data: results.map((r) => ({
      projectId,
      turkId: null,
      category: r.category,
      title: r.title,
      content: r.content,
      sourceUrl: `https://api.m4th.com`,
      metadata: r.error ? { error: true } : Prisma.JsonNull,
    })),
  });

  // Update timestamps
  await prisma.investorProject.update({
    where: { id: params.id },
    data: { lastRunAt: new Date() },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "completed" },
  });

  return NextResponse.json({
    ok: true,
    ticker,
    entriesCreated: entries.count,
    results: results.map((r) => ({
      category: r.category,
      title: r.title,
      error: r.error || false,
    })),
  });
}
