/**
 * WebSocket client service — singleton that connects once and routes events.
 */

type EventHandler = (data: Record<string, unknown>) => void;

/** Whitelist of valid server-sent event names. Only these are dispatched to handlers. */
const VALID_EVENTS = new Set([
  "pong", "device.connected", "device.disconnected", "devices.list",
  "browser.open_item", "browser.open_location", "photo.request", "photo.uploaded",
  "barcode.capture_unavailable", "barcode.scanned",
  "delete.confirm_request", "delete.done", "delete.rejected", "delete.no_device",
  "session.ready", "session.kicked", "login.confirmed", "user.activated",
  "print.done", "print.failed",
  "checkout.approved", "checkout.rejected",
  "admin.new_user_registered", "admin.checkout_requested",
  "stats.archive_updated", "stats.collection_updated",
]);

class WSClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private _sessionId: number | null = null;
  private lastPresence: Record<string, unknown> | null = null;

  get sessionId() { return this._sessionId; }
  get connected() { return this.ws?.readyState === WebSocket.OPEN; }
  private get debug() { return process.env.NODE_ENV !== "production"; }

  async connect(serverURL: string) {
    // Don't reconnect if already connected or connecting
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    // Get a short-lived WS ticket via the HttpOnly cookie session
    const ticket = await this.fetchTicket();
    if (!ticket) return;

    const base = serverURL;
    const wsUrl = base.replace(/^http/, "ws");
    const url = `${wsUrl}/ws?ticket=${encodeURIComponent(ticket)}&device_type=browser&device_name=${encodeURIComponent(this.getBrowserName())}`;

    this.ws = new WebSocket(url);
    this.attachSocketHandlers(serverURL);
  }

  disconnect() {
    this.clearReconnectTimer();
    this.stopPing();
    this.ws?.close();
    this.ws = null;
    this._sessionId = null;
  }

  send(type: string, data?: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  updatePresence(data: Record<string, unknown>) {
    this.lastPresence = data;
    this.send("presence.update", data);
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => { this.handlers.get(event)?.delete(handler); };
  }

  private emit(event: string, data: Record<string, unknown>) {
    this.handlers.get(event)?.forEach((h) => {
      try { h(data); } catch {}
    });
  }

  private async fetchTicket() {
    try {
      const res = await fetch("/api/auth/ws-ticket", { method: "POST", credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.ticket === "string" ? data.ticket : null;
    } catch {
      return null;
    }
  }

  private attachSocketHandlers(serverURL: string) {
    if (!this.ws) return;

    this.ws.onopen = () => {
      if (this.debug) console.debug("[WS] Connected");
      this.emit("_connected", {});
      this.startPing();
      this.flushPresence();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      if (this.debug) console.debug("[WS] Disconnected");
      this.stopPing();
      this.emit("_disconnected", {});
      this.ws = null;
      this.scheduleReconnect(serverURL);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private handleMessage(raw: unknown) {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === "pong") return;
      if (!msg.event || !VALID_EVENTS.has(msg.event)) return;
      if (msg.event === "session.ready" && typeof msg.data?.session_id === "number") {
        this._sessionId = msg.data.session_id;
      }
      this.emit(msg.event, msg.data || {});
    } catch {}
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private scheduleReconnect(serverURL: string) {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (typeof window !== "undefined") {
        void this.connect(serverURL);
      }
    }, 5000);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      } else {
        this.stopPing();
      }
    }, 30000);
  }

  private flushPresence() {
    if (this.lastPresence) {
      this.send("presence.update", this.lastPresence);
    }
  }

  private stopPing() {
    if (!this.pingTimer) return;
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private getBrowserName(): string {
    if (typeof navigator === "undefined") return "Browser";
    const ua = navigator.userAgent;

    // OS
    let os = "Unknown";
    if (ua.includes("Mac OS X")) os = "Mac";
    else if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("iPad")) os = "iPad";
    else if (ua.includes("iPhone")) os = "iPhone";
    else if (ua.includes("Android")) os = "Android";

    // Browser
    let browser = "Browser";
    if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
    else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

    return `${browser} (${os})`;
  }
}

export const wsClient = new WSClient();
