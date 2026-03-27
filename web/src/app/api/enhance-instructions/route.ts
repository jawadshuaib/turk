import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { instructions, targetUrl, model } = await req.json();

  if (!instructions?.trim()) {
    return NextResponse.json(
      { error: "Instructions are required" },
      { status: 400 }
    );
  }

  const ollamaUrl =
    process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  // Use the provided model, or detect the first available one
  let ollamaModel = model || "llama3.1:8b";
  if (!model) {
    try {
      const tagsRes = await fetch(`${ollamaUrl}/api/tags`);
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        if (tags.models?.length > 0) {
          ollamaModel = tags.models[0].name;
        }
      }
    } catch {
      // use default
    }
  }

  const systemPrompt = `You are an expert QA test engineer. The user has written rough testing instructions for an AI agent that will autonomously test a website using a browser. Your job is to enhance these instructions to be more thorough, specific, and actionable.

Rules:
- Keep the user's original intent and scope — don't add unrelated test areas
- Make instructions specific and step-by-step where possible
- Add edge cases the user may have missed (empty inputs, special characters, long strings, etc.)
- Include checks for accessibility, responsiveness, and error handling where relevant
- Mention what "success" looks like for each test area
- Keep it concise — bullet points are fine
- Do NOT wrap in markdown code blocks, just return the improved instructions as plain text
- Write in second person ("Test the...", "Verify that...", "Check whether...")`;

  const userPrompt = `${targetUrl ? `Target website: ${targetUrl}\n\n` : ""}Original instructions:\n${instructions}\n\nPlease enhance these testing instructions.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Ollama error: ${text}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const enhanced = data.message?.content || "";

    return NextResponse.json({ enhanced });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out. Your Ollama model may be too slow for this prompt." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to connect to Ollama",
      },
      { status: 502 }
    );
  }
}
