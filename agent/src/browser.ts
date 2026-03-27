import { chromium, Browser, Page, BrowserContext } from "playwright";

export interface PageState {
  url: string;
  title: string;
  elements: ElementInfo[];
  consoleErrors: string[];
  networkErrors: string[];
}

export interface ElementInfo {
  tag: string;
  selector: string;
  text: string;
  type?: string;
  visible: boolean;
  role?: string;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private consoleErrors: string[] = [];
  private networkErrors: string[] = [];

  async launch() {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    this.page = await this.context.newPage();

    // Capture console errors
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.consoleErrors.push(msg.text());
      }
    });

    // Capture network errors
    this.page.on("requestfailed", (request) => {
      this.networkErrors.push(
        `${request.method()} ${request.url()} - ${request.failure()?.errorText}`
      );
    });
  }

  getPage(): Page {
    if (!this.page) throw new Error("Browser not launched");
    return this.page;
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  }

  async goBack(): Promise<void> {
    const page = this.getPage();
    await page.goBack({ waitUntil: "networkidle", timeout: 15000 });
  }

  async scroll(direction: "down" | "up" = "down"): Promise<void> {
    const page = this.getPage();
    await page.evaluate((dir) => {
      window.scrollBy(0, dir === "down" ? 600 : -600);
    }, direction);
  }

  async click(selector: string): Promise<void> {
    const page = this.getPage();
    await page.click(selector, { timeout: 10000 });
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  async fill(selector: string, value: string): Promise<void> {
    const page = this.getPage();
    await page.fill(selector, value, { timeout: 10000 });
  }

  async screenshot(): Promise<string> {
    const page = this.getPage();
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return buffer.toString("base64");
  }

  async getPageState(): Promise<PageState> {
    const page = this.getPage();

    const elements = await page.evaluate(() => {
      const results: Array<{
        tag: string;
        selector: string;
        text: string;
        type?: string;
        visible: boolean;
        role?: string;
      }> = [];

      // Get interactive elements
      const selectors = [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        '[role="button"]',
        '[role="link"]',
        '[role="tab"]',
        '[role="menuitem"]',
      ];

      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el, idx) => {
          const htmlEl = el as HTMLElement;
          const rect = htmlEl.getBoundingClientRect();
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            htmlEl.offsetParent !== null;

          if (!visible) return;

          const text = (
            htmlEl.textContent?.trim() ||
            htmlEl.getAttribute("placeholder") ||
            htmlEl.getAttribute("aria-label") ||
            htmlEl.getAttribute("title") ||
            ""
          ).slice(0, 100);

          // Build a usable selector
          let selector = "";
          if (htmlEl.id) {
            selector = `#${htmlEl.id}`;
          } else if (htmlEl.getAttribute("data-testid")) {
            selector = `[data-testid="${htmlEl.getAttribute("data-testid")}"]`;
          } else if (htmlEl.getAttribute("name")) {
            selector = `${el.tagName.toLowerCase()}[name="${htmlEl.getAttribute("name")}"]`;
          } else {
            selector = `${el.tagName.toLowerCase()}:nth-of-type(${idx + 1})`;
          }

          results.push({
            tag: el.tagName.toLowerCase(),
            selector,
            text,
            type: htmlEl.getAttribute("type") || undefined,
            visible,
            role: htmlEl.getAttribute("role") || undefined,
          });
        });
      }

      return results;
    });

    const errors = [...this.consoleErrors];
    const netErrors = [...this.networkErrors];
    this.consoleErrors = [];
    this.networkErrors = [];

    return {
      url: page.url(),
      title: await page.title(),
      elements,
      consoleErrors: errors,
      networkErrors: netErrors,
    };
  }

  async assertText(selector: string, expected: string): Promise<boolean> {
    const page = this.getPage();
    try {
      const text = await page.textContent(selector, { timeout: 5000 });
      return text?.includes(expected) ?? false;
    } catch {
      return false;
    }
  }

  async close() {
    await this.browser?.close();
  }
}
