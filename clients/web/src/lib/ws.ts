/**
 * WebSocket client service — singleton that connects once and routes events.
 */

type EventHandler = (data: Record<string, unknown>) => void;

/** Whitelist of valid server-sent event names. Only these are dispatched to handlers. */
const VALID_EVENTS = new Set([
  "pong", "device.connected", "device.disconnected", "devices.list",
  "browser.open_item", "browser.open_location", "photo.request", "photo.uploaded",
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
  private _sessionId: number | null = null;

  get sessionId() { return this._sessionId; }
  get connected() { return this.ws?.readyState === WebSocket.OPEN; }

  async connect(serverURL: string) {
    // Don't reconnect if already connected or connecting
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    // Get a short-lived WS ticket via the HttpOnly cookie session
    let ticket: string;
    try {
      const res = await fetch("/api/auth/ws-ticket", { method: "POST", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      ticket = data.ticket;
    } catch {
      return;
    }

    const base = typeof window !== "undefined" ? window.location.origin : serverURL;
    const wsUrl = base.replace(/^http/, "ws");
    const url = `${wsUrl}/ws?ticket=${encodeURIComponent(ticket)}&device_type=browser&device_name=${encodeURIComponent(this.getBrowserName())}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.emit("_connected", {});
      // Start ping interval
      this.startPing();
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "pong") return;
        if (msg.event && VALID_EVENTS.has(msg.event)) {
          if (msg.event === "session.ready" && typeof msg.data?.session_id === "number") {
            this._sessionId = msg.data.session_id;
          }
          this.emit(msg.event, msg.data || {});
        }
      } catch {}
    };

    this.ws.onclose = () => {
      console.log("[WS] Disconnected");
      this.emit("_disconnected", {});
      this.ws = null;
      // Reconnect after 5 seconds
      this.reconnectTimer = setTimeout(() => {
        if (typeof window !== "undefined") {
          this.connect(serverURL);
        }
      }, 5000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._sessionId = null;
  }

  send(type: string, data?: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
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

  private startPing() {
    const interval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      } else {
        clearInterval(interval);
      }
    }, 30000);
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
