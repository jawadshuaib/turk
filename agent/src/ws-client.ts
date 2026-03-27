import WebSocket from "ws";

type MessageHandler = (msg: Record<string, unknown>) => void;

export class WSClient {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectInterval = 3000;
  private maxReconnectAttempts = 10;
  private reconnectAttempts = 0;
  private shouldReconnect = true;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
        this.ws?.terminate();
      }, 15000);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        console.log("[WS] Connected");
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          for (const handler of this.handlers) {
            handler(msg);
          }
        } catch {
          // ignore malformed
        }
      });

      this.ws.on("close", () => {
        clearTimeout(timeout);
        console.log("[WS] Disconnected");
        this.attemptReconnect();
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        console.error("[WS] Error:", err.message);
        // Only reject on initial connection
        if (this.reconnectAttempts === 0) {
          reject(err);
        }
      });
    });
  }

  private attemptReconnect() {
    if (!this.shouldReconnect) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(
        `[WS] Max reconnection attempts (${this.maxReconnectAttempts}) reached, giving up`
      );
      return;
    }

    const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    console.log(
      `[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      if (!this.shouldReconnect) return;
      this.connect().catch((err) => {
        console.error("[WS] Reconnection failed:", err.message);
      });
    }, delay);
  }

  send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
  }

  close() {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}
