import { BrowserManager, PageState } from "./browser";
import { OllamaClient } from "./ollama-client";
import { WSClient } from "./ws-client";

interface TaskConfig {
  turkId: string;
  targetUrl: string;
  instructions: string;
  credentials: Record<string, Record<string, string>>;
}

export class TaskRunner {
  private browser: BrowserManager;
  private ollama: OllamaClient;
  private ws: WSClient;
  private config: TaskConfig;
  private running = false;
  private paused = false;
  private stepCount = 0;
  private maxSteps = 200;
  private userInstructions: string[] = [];

  constructor(
    browser: BrowserManager,
    ollama: OllamaClient,
    ws: WSClient,
    config: TaskConfig
  ) {
    this.browser = browser;
    this.ollama = ollama;
    this.ws = ws;
    this.config = config;
  }

  private buildSystemPrompt(): string {
    const credentialInfo = Object.entries(this.config.credentials)
      .map(
        ([name, fields]) =>
          `${name}: ${Object.entries(fields)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}`
      )
      .join("\n");

    return `You are an autonomous QA testing agent. You are testing a website like a human tester would.

TARGET WEBSITE: ${this.config.targetUrl}

YOUR INSTRUCTIONS:
${this.config.instructions}

${credentialInfo ? `AVAILABLE CREDENTIALS:\n${credentialInfo}\n` : ""}
AVAILABLE ACTIONS (respond with JSON):
- {"thought": "...", "action": "navigate", "params": {"url": "..."}}
- {"thought": "...", "action": "click", "params": {"selector": "..."}}
- {"thought": "...", "action": "fill", "params": {"selector": "...", "value": "..."}}
- {"thought": "...", "action": "screenshot", "params": {}}
- {"thought": "...", "action": "scroll", "params": {"direction": "down|up"}}
- {"thought": "...", "action": "go_back", "params": {}}
- {"thought": "...", "action": "assert_text", "params": {"selector": "...", "expected": "..."}}
- {"thought": "...", "action": "report_bug", "params": {"severity": "critical|major|minor|cosmetic", "title": "...", "description": "..."}}
- {"thought": "...", "action": "wait", "params": {"ms": "2000"}}
- {"thought": "...", "action": "done", "params": {"summary": "..."}}

RULES:
1. Always start by navigating to the target URL.
2. Explore the site methodically - test navigation, forms, buttons, links.
3. Report any bugs you find: broken links, JS errors, layout issues, missing content, unexpected behavior.
4. Use credentials when you need to log in.
5. Take screenshots periodically to document your findings.
6. Think step by step about what a human tester would check.
7. After testing thoroughly, use "done" to finish.

Respond ONLY with valid JSON. Always include a "thought" explaining your reasoning.`;
  }

  async run() {
    this.running = true;

    try {
      // Navigate to the target URL first
      this.sendUpdate("thought", "Starting test - navigating to target URL");
      this.sendUpdate("status", "running");

      try {
        await this.browser.navigate(this.config.targetUrl);
        this.sendAction("navigate", { url: this.config.targetUrl });
        this.sendResult(true, `Navigated to ${this.config.targetUrl}`);
        this.stepCount++;
      } catch (navErr) {
        const navMsg =
          navErr instanceof Error ? navErr.message : "Navigation failed";
        this.sendUpdate(
          "error",
          `Failed to navigate to ${this.config.targetUrl}: ${navMsg}. If the site runs on your host machine, use host.docker.internal instead of localhost.`
        );
        this.sendResult(false, navMsg);
        // Don't abort — let the LLM decide what to do
      }

      while (this.running && this.stepCount < this.maxSteps) {
        // Check if paused
        while (this.paused && this.running) {
          await this.sleep(1000);
        }
        if (!this.running) break;

        // Get current page state
        let pageState;
        try {
          pageState = await this.browser.getPageState();
        } catch (psErr) {
          const psMsg =
            psErr instanceof Error ? psErr.message : "Failed to get page state";
          this.sendUpdate("error", `Page state error: ${psMsg}`);
          await this.sleep(2000);
          continue;
        }

        // Check for console/network errors and report them
        this.reportAutomaticBugs(pageState);

        // Build the context for the LLM
        const context = this.buildContext(pageState);

        // Get decision from Ollama
        this.sendUpdate("thought", "Analyzing page and deciding next action...");

        let decision;
        try {
          decision = await this.ollama.decide(
            this.buildSystemPrompt(),
            context
          );
        } catch (ollamaErr) {
          const ollamaMsg =
            ollamaErr instanceof Error
              ? ollamaErr.message
              : "Ollama unreachable";
          this.sendUpdate(
            "error",
            `Ollama error: ${ollamaMsg}. Make sure Ollama is running (ollama serve).`
          );
          // Wait and retry instead of crashing
          await this.sleep(5000);
          continue;
        }

        // Send thought to UI
        this.sendUpdate("thought", decision.thought);

        // Execute the action
        await this.executeAction(decision.action, decision.params);

        this.stepCount++;

        // Small delay between steps
        await this.sleep(1500);
      }

      if (this.stepCount >= this.maxSteps) {
        this.sendComplete(
          `Reached maximum steps (${this.maxSteps}). Testing session complete.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.sendUpdate("error", message);
      this.sendComplete(`Testing ended due to error: ${message}`);
    }
  }

  private buildContext(pageState: PageState): string {
    const pendingInstructions = this.userInstructions.splice(0);
    const userMsg = pendingInstructions.length
      ? `\n\nNEW USER INSTRUCTIONS: ${pendingInstructions.join(". ")}`
      : "";

    const elements = pageState.elements
      .slice(0, 25) // limit elements to keep context small for local LLMs
      .map(
        (e) =>
          `[${e.tag}${e.type ? `:${e.type}` : ""}] selector="${e.selector}" text="${e.text}"`
      )
      .join("\n");

    return `Current page state:
URL: ${pageState.url}
Title: ${pageState.title}
Step: ${this.stepCount + 1}/${this.maxSteps}

Interactive elements:
${elements || "(no interactive elements found)"}

${pageState.consoleErrors.length ? `Console errors: ${pageState.consoleErrors.join("; ")}` : ""}
${pageState.networkErrors.length ? `Network errors: ${pageState.networkErrors.join("; ")}` : ""}
${userMsg}

What should we do next?`;
  }

  private async executeAction(
    action: string,
    params: Record<string, string>
  ) {
    try {
      switch (action) {
        case "navigate":
          this.sendAction("navigate", params);
          await this.browser.navigate(params.url);
          this.sendResult(true, `Navigated to ${params.url}`);
          break;

        case "click":
          this.sendAction("click", params);
          await this.browser.click(params.selector);
          this.sendResult(true, `Clicked ${params.selector}`);
          break;

        case "fill":
          this.sendAction("fill", params);
          await this.browser.fill(params.selector, params.value);
          this.sendResult(true, `Filled ${params.selector}`);
          break;

        case "scroll":
          this.sendAction("scroll", params);
          await this.browser.scroll(
            (params.direction as "down" | "up") || "down"
          );
          this.sendResult(true, `Scrolled ${params.direction || "down"}`);
          break;

        case "go_back":
          this.sendAction("go_back", params);
          await this.browser.goBack();
          this.sendResult(true, "Navigated back");
          break;

        case "screenshot": {
          this.sendAction("screenshot", params);
          const base64 = await this.browser.screenshot();
          this.ws.send({
            type: "agent_update",
            turkId: this.config.turkId,
            data: { kind: "screenshot", base64 },
          });
          break;
        }

        case "assert_text": {
          this.sendAction("assert_text", params);
          const found = await this.browser.assertText(
            params.selector,
            params.expected
          );
          this.sendResult(
            found,
            found
              ? `Text "${params.expected}" found`
              : `Text "${params.expected}" NOT found at ${params.selector}`
          );
          if (!found) {
            this.sendBugReport(
              "minor",
              `Expected text not found: "${params.expected}"`,
              `Expected to find "${params.expected}" at selector "${params.selector}" but it was not present.`
            );
          }
          break;
        }

        case "report_bug":
          this.sendBugReport(
            params.severity || "minor",
            params.title,
            params.description
          );
          break;

        case "wait":
          await this.sleep(parseInt(params.ms) || 2000);
          this.sendResult(true, `Waited ${params.ms}ms`);
          break;

        case "done":
          this.sendComplete(params.summary || "Testing complete");
          break;

        default:
          this.sendResult(false, `Unknown action: ${action}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      this.sendResult(false, message);

      // Report action failures as potential bugs
      if (action === "click" || action === "fill") {
        this.sendBugReport(
          "minor",
          `Element interaction failed: ${params.selector}`,
          `Attempted to ${action} on "${params.selector}" but failed: ${message}`
        );
      }
    }
  }

  private reportAutomaticBugs(pageState: PageState) {
    for (const error of pageState.consoleErrors) {
      this.sendBugReport(
        "major",
        "JavaScript console error",
        `Console error detected: ${error}`
      );
    }
    for (const error of pageState.networkErrors) {
      this.sendBugReport("major", "Network request failed", error);
    }
  }

  handleUserInstruction(content: string) {
    this.userInstructions.push(content);
    this.ollama.addContext("user", `New instruction from user: ${content}`);
  }

  pause() {
    this.paused = true;
    this.sendUpdate("status", "paused");
  }

  resume() {
    this.paused = false;
    this.sendUpdate("status", "running");
  }

  stop() {
    this.running = false;
    this.sendComplete("Stopped by user");
  }

  private sendComplete(summary: string) {
    this.ws.send({
      type: "agent_update",
      turkId: this.config.turkId,
      data: {
        kind: "status",
        status: "completed",
        content: summary,
        summary,
        stepCount: this.stepCount,
      },
    });
    this.running = false;
  }

  private sendUpdate(kind: string, content: string) {
    this.ws.send({
      type: "agent_update",
      turkId: this.config.turkId,
      data: { kind, content, status: kind === "status" ? content : undefined },
    });
  }

  private sendAction(action: string, params: Record<string, string>) {
    this.ws.send({
      type: "agent_update",
      turkId: this.config.turkId,
      data: { kind: "action", action, params },
    });
  }

  private sendResult(success: boolean, detail: string) {
    this.ws.send({
      type: "agent_update",
      turkId: this.config.turkId,
      data: { kind: "result", success, detail },
    });
  }

  private sendBugReport(
    severity: string,
    title: string,
    description: string
  ) {
    this.ws.send({
      type: "agent_update",
      turkId: this.config.turkId,
      data: {
        kind: "bug_report",
        severity,
        title,
        description,
        steps: [`Step ${this.stepCount}`],
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
