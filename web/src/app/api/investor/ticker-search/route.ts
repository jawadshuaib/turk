import { NextRequest, NextResponse } from "next/server";
import { searchTicker } from "@/lib/m4th-api";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.length < 1) {
    return NextResponse.json([]);
  }
  try {
    const results = await searchTicker(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
