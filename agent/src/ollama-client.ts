export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentDecision {
  thought: string;
  action: string;
  params: Record<string, string>;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private history: ChatMessage[] = [];
  private maxHistory = 20;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async decide(
    systemPrompt: string,
    currentState: string
  ): Promise<AgentDecision> {
    // Keep history manageable
    if (this.history.length > this.maxHistory) {
      const summary = this.history
        .slice(0, this.history.length - 10)
        .map((m) => `${m.role}: ${m.content.slice(0, 100)}`)
        .join("\n");
      this.history = [
        {
          role: "assistant",
          content: `[Previous actions summary]\n${summary}`,
        },
        ...this.history.slice(-10),
      ];
    }

    this.history.push({ role: "user", content: currentState });

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...this.history,
    ];

    const content = await this.callWithRetry(messages);

    this.history.push({ role: "assistant", content });

    try {
      const parsed = JSON.parse(content);
      return {
        thought: parsed.thought || "No reasoning provided",
        action: parsed.action || "screenshot",
        params: parsed.params || {},
      };
    } catch {
      // If the model doesn't return valid JSON, treat it as a thought
      return {
        thought: content,
        action: "screenshot",
        params: {},
      };
    }
  }

  private async callWithRetry(
    messages: ChatMessage[],
    maxRetries = 3
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

        console.log(
          `[Ollama] Calling ${this.model} (attempt ${attempt}/${maxRetries}, ${messages.length} messages)`
        );

        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            messages,
            format: "json",
            stream: false,
            options: {
              num_predict: 512, // Limit output tokens for speed
              temperature: 0.3, // More deterministic
            },
          }),
          signal: controller.signal,
        });

        console.log(`[Ollama] Response status: ${response.status}`);

        clearTimeout(timeout);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Ollama error ${response.status}: ${text}`);
        }

        const data = (await response.json()) as {
          message?: { content?: string };
        };
        return data.message?.content || "";
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(
          `[Ollama] Attempt ${attempt}/${maxRetries} failed: ${message}`
        );
        if (attempt === maxRetries) throw err;
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    throw new Error("Ollama: all retries exhausted");
  }

  addContext(role: "user" | "assistant", content: string) {
    this.history.push({ role, content });
  }
}
