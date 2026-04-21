import { buildWebSocketUrl } from "./app-config";

const API_WS_PATH = "/apiws";
const API_WS_REQUEST_TIMEOUT_MS = 30_000;
const API_WS_RECONNECT_BASE_DELAY_MS = 500;
const API_WS_RECONNECT_MAX_DELAY_MS = 5_000;

type ApiWsRequestPayload = {
  type: "api.request";
  id: string;
  method: "POST";
  path: string;
  headers?: Record<string, string>;
  bodyText?: string;
};

type ApiWsResponsePayload = {
  type: "api.response";
  id: string;
  status: number;
  ok: boolean;
  bodyText?: string;
};

type ApiWsRequestResult = {
  status: number;
  ok: boolean;
  bodyText: string;
};

type ApiWsEventListener = (payload: Record<string, unknown>) => void;
type ApiWsOpenListener = () => void;

type PendingRequest = {
  resolve: (value: ApiWsRequestResult) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

class ApiWsClient {
  private socket: WebSocket | null = null;
  private connectPromise: Promise<WebSocket> | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private shouldNotifyOpenListeners = false;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly eventListeners = new Set<ApiWsEventListener>();
  private readonly openListeners = new Set<ApiWsOpenListener>();

  public async request(payload: Omit<ApiWsRequestPayload, "type" | "id">) {
    const socket = await this.connect();
    const id = crypto.randomUUID();

    return await new Promise<ApiWsRequestResult>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("apiws request timed out"));
      }, API_WS_REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve,
        reject,
        timeoutId,
      });

      socket.send(
        JSON.stringify({
          ...payload,
          type: "api.request",
          id,
        } satisfies ApiWsRequestPayload),
      );
    });
  }

  public async send(payload: Record<string, unknown>) {
    const socket = await this.connect();
    socket.send(JSON.stringify(payload));
  }

  public sendIfOpen(payload: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(JSON.stringify(payload));
    return true;
  }

  public subscribe(listener: ApiWsEventListener) {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public onOpen(listener: ApiWsOpenListener) {
    this.openListeners.add(listener);

    return () => {
      this.openListeners.delete(listener);
    };
  }

  private connect() {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("apiws is only available in the browser"));
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.socket);
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.clearReconnectTimer();

    this.connectPromise = new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(buildWebSocketUrl(API_WS_PATH, {}));
      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.connectPromise = null;
        if (this.shouldNotifyOpenListeners) {
          this.shouldNotifyOpenListeners = false;
          this.openListeners.forEach((listener) => listener());
        }
        resolve(socket);
      };

      socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        if (socket.readyState !== WebSocket.OPEN) {
          this.connectPromise = null;
          reject(new Error("apiws connection failed"));
        }
      };

      socket.onclose = () => {
        if (this.socket === socket) {
          this.socket = null;
        }

        this.connectPromise = null;
        this.rejectPending(new Error("apiws connection closed"));

        if (this.eventListeners.size > 0 || this.openListeners.size > 0) {
          this.scheduleReconnect();
        }
      };
    });

    return this.connectPromise;
  }

  private handleMessage(rawData: unknown) {
    let payload: Record<string, unknown> | null = null;

    try {
      payload =
        typeof rawData === "string"
          ? JSON.parse(rawData)
          : JSON.parse(String(rawData));
    } catch {
      return;
    }

    if (!payload || payload.type !== "api.response" || typeof payload.id !== "string") {
      if (payload) {
        this.eventListeners.forEach((listener) => listener(payload));
      }

      return;
    }

    const response = payload as ApiWsResponsePayload;
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timeoutId);
    this.pending.delete(response.id);
    pending.resolve({
      status: response.status,
      ok: response.ok,
      bodyText: response.bodyText ?? "",
    });
  }

  private rejectPending(error: Error) {
    for (const [id, pending] of this.pending.entries()) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) {
      return;
    }

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  public scheduleReconnect() {
    if (this.socket || this.connectPromise || this.reconnectTimer !== null) {
      return;
    }

    this.shouldNotifyOpenListeners = true;
    this.reconnectAttempts += 1;
    const delayMs = Math.min(
      API_WS_RECONNECT_MAX_DELAY_MS,
      API_WS_RECONNECT_BASE_DELAY_MS *
        2 ** Math.max(0, this.reconnectAttempts - 1),
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => {
        this.scheduleReconnect();
      });
    }, delayMs);
  }
}

const apiWsClient = new ApiWsClient();

export function apiWsRequest(payload: Omit<ApiWsRequestPayload, "type" | "id">) {
  return apiWsClient.request(payload);
}

export function apiWsSend(payload: Record<string, unknown>) {
  return apiWsClient.send(payload);
}

export function apiWsSendIfOpen(payload: Record<string, unknown>) {
  return apiWsClient.sendIfOpen(payload);
}

export function apiWsSubscribe(listener: ApiWsEventListener) {
  return apiWsClient.subscribe(listener);
}

export function apiWsOnOpen(listener: ApiWsOpenListener) {
  return apiWsClient.onOpen(listener);
}
