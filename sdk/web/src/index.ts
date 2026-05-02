import type { ClickEvent, ConversionEvent, LoginEvent } from "../../../packages/contracts/src/events.js";
import type { DeviceDetails } from "../../../packages/contracts/src/device.js";

type FetchLike = typeof fetch;

const DEFAULT_SESSION_STORAGE_KEY = "securetarget_session_id";

export interface SecureTargetClientConfig {
  apiKey: string;
  companyId: string;
  endpoint: string;
  fetchImpl?: FetchLike;
  /** Override sessionStorage key for the opaque session id */
  storageKey?: string;
  /** Skip bootstrap (no device capture). Only valid if ingest does not require sessions. */
  skipSession?: boolean;
  /** Provide device details manually once (e.g. SSR); otherwise collected on web automatically */
  initialDevice?: DeviceDetails;
}

function collectWebDevice(): DeviceDetails {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return { platform: "web", sdkVersion: "0.2.0" };
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    platform: "web",
    sdkVersion: "0.2.0",
    userAgent: navigator.userAgent,
    locale: navigator.language,
    timezone: tz,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    pixelRatio: window.devicePixelRatio,
    hardwareConcurrency: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : undefined
  };
}

export class SecureTargetClient {
  private readonly apiKey: string;
  private readonly companyId: string;
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;
  private readonly storageKey: string;
  private readonly skipSession: boolean;
  private readonly initialDevice?: DeviceDetails;
  private token: string | null = null;
  private sessionId: string | null = null;
  private sessionReady: Promise<void> | null = null;

  constructor(config: SecureTargetClientConfig) {
    this.apiKey = config.apiKey;
    this.companyId = config.companyId;
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.storageKey = config.storageKey ?? DEFAULT_SESSION_STORAGE_KEY;
    this.skipSession = Boolean(config.skipSession);
    this.initialDevice = config.initialDevice;
  }

  /**
   * Only used when `skipSession` is true. When sessions are enabled, the record `token` is always the
   * bootstrap `sessionId` (your per-install identifier for correlation).
   */
  setLoginToken(token: string): void {
    this.token = token;
  }

  /** Clears stored session (e.g. logout). Next request will bootstrap again if sessions enabled. */
  clearSession(): void {
    this.sessionId = null;
    this.sessionReady = null;
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.removeItem(this.storageKey);
      } catch {
        /* ignore */
      }
    }
  }

  private loadCachedSession(): void {
    if (this.skipSession || typeof sessionStorage === "undefined") return;
    try {
      const v = sessionStorage.getItem(this.storageKey);
      if (v) this.sessionId = v;
    } catch {
      /* ignore */
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.skipSession) return;
    this.loadCachedSession();
    if (this.sessionId) return;
    if (this.sessionReady) {
      await this.sessionReady;
      return;
    }
    this.sessionReady = this.doBootstrap();
    try {
      await this.sessionReady;
    } finally {
      this.sessionReady = null;
    }
  }

  private async doBootstrap(): Promise<void> {
    const device = this.initialDevice ?? collectWebDevice();
    const body = {
      occurredAt: new Date().toISOString(),
      device
    };
    const res = await this.fetchImpl(`${this.endpoint}/v1/session/bootstrap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Session bootstrap failed: ${res.status} ${errText}`);
    }
    const data = (await res.json()) as { sessionId?: string };
    if (!data.sessionId || typeof data.sessionId !== "string") {
      throw new Error("Session bootstrap returned no sessionId");
    }
    this.sessionId = data.sessionId;
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem(this.storageKey, this.sessionId);
      } catch {
        /* ignore */
      }
    }
  }

  /** Opaque id sent as `token` on every `/v1/record` body: bootstrap `sessionId`, or `setLoginToken` when `skipSession`. */
  private recordToken(): string | null {
    if (this.sessionId) return this.sessionId;
    if (this.skipSession) return this.token;
    return null;
  }

  async trackClick(clickData: Omit<ClickEvent, "actionType" | "companyId">): Promise<Response> {
    await this.ensureSession();
    const t = this.recordToken() ?? clickData.token;
    return this.send({
      ...clickData,
      actionType: "click",
      companyId: this.companyId,
      ...(t ? { token: t } : {})
    } satisfies ClickEvent);
  }

  async trackLogin(loginData: Omit<LoginEvent, "actionType" | "companyId" | "token">): Promise<Response> {
    await this.ensureSession();
    const t = this.recordToken();
    if (!t) {
      throw new Error("Session or token required. Complete bootstrap or set skipSession + setLoginToken.");
    }
    return this.send({
      ...loginData,
      actionType: "login",
      companyId: this.companyId,
      token: t
    } satisfies LoginEvent);
  }

  async trackConversion(conversionData: Omit<ConversionEvent, "actionType" | "companyId" | "token">): Promise<Response> {
    await this.ensureSession();
    const t = this.recordToken();
    if (!t) {
      throw new Error("Session or token required. Complete bootstrap or set skipSession + setLoginToken.");
    }
    return this.send({
      ...conversionData,
      actionType: "conversion",
      companyId: this.companyId,
      token: t
    } satisfies ConversionEvent);
  }

  private async send(payload: unknown): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey
    };
    if (this.sessionId) {
      headers["x-session-id"] = this.sessionId;
    }
    return this.fetchImpl(`${this.endpoint}/v1/record`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  }
}

export function init(config: SecureTargetClientConfig): SecureTargetClient {
  return new SecureTargetClient(config);
}

export type { DeviceDetails };
