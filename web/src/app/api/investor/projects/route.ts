import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const investorProjects = await prisma.investorProject.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        include: {
          _count: { select: { turks: true, memoryEntries: true } },
        },
      },
    },
  });
  return NextResponse.json(investorProjects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticker, companyName, exchange } = body;

  if (!ticker?.trim()) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  // Create a Project and InvestorProject together
  const project = await prisma.project.create({
    data: {
      name: `${ticker.toUpperCase()} Research`,
      description: `Investment research for ${companyName || ticker}`,
      objective: `Gather valuation data, financial metrics, and analysis for ${ticker.toUpperCase()} (${companyName || ""}) to produce a comprehensive investment research report.`,
      investorProject: {
        create: {
          ticker: ticker.toUpperCase().trim(),
          companyName: companyName?.trim() || "",
          exchange: exchange?.trim() || "",
        },
      },
    },
    include: {
      investorProject: true,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
