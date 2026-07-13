import type { ConversionEvent, CustomEvent, InstallEvent, LoginEvent, RecordEvent } from "../../../packages/contracts/src/events.js";
import type { DeviceDetails, UtmParams } from "../../../packages/contracts/src/device.js";

type FetchLike = typeof fetch;

const DEFAULT_SESSION_STORAGE_KEY = "eventiqn_session_id";
const FIRST_OPEN_KEY = "eventiqn_first_open_sent";
const CLICK_ID_KEY = "eventiqn_click_id";

export interface InstallAttributionResult {
  attributed: boolean;
  isOrganic: boolean;
  confidence: number;
  mediaSource?: string | null;
  campaignId?: string | null;
  adgroupId?: string | null;
  creativeId?: string | null;
  clickId?: string | null;
  deepLinkValue?: string | null;
  ruleName?: string;
}

export type InstallAttributionCallback = (result: InstallAttributionResult) => void;

export interface EventIQNClientConfig {
  apiKey: string;
  companyId: string;
  endpoint: string;
  fetchImpl?: FetchLike;
  storageKey?: string;
  skipSession?: boolean;
  initialDevice?: DeviceDetails;
  /** Auto-fire install event on first session (default true) */
  autoTrackInstall?: boolean;
  /** Auto-capture UTMs / st_click_id from URL on init (default true) */
  autoCaptureAcquisition?: boolean;
}

function parseUtmFromUrl(): UtmParams | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source") ?? undefined;
  const medium = params.get("utm_medium") ?? undefined;
  const campaign = params.get("utm_campaign") ?? undefined;
  const term = params.get("utm_term") ?? undefined;
  const content = params.get("utm_content") ?? undefined;
  if (!source && !medium && !campaign && !term && !content) return undefined;
  return { source, medium, campaign, term, content };
}

function getClickIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("st_click_id");
}

function getClickIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)st_click_id=([^;]+)/);
  return match?.[1] ?? null;
}

function collectWebDevice(extra?: Partial<DeviceDetails>): DeviceDetails {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return { platform: "web", sdkVersion: "0.3.0", ...extra };
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const utm = parseUtmFromUrl();
  return {
    platform: "web",
    sdkVersion: "0.3.0",
    userAgent: navigator.userAgent,
    locale: navigator.language,
    timezone: tz,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    pixelRatio: window.devicePixelRatio,
    hardwareConcurrency: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : undefined,
    utm,
    deepLinkUrl: typeof window !== "undefined" ? window.location.href : undefined,
    ...extra
  };
}

export class EventIQNClient {
  private readonly apiKey: string;
  private readonly companyId: string;
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;
  private readonly storageKey: string;
  private readonly skipSession: boolean;
  private readonly initialDevice?: DeviceDetails;
  private readonly autoTrackInstall: boolean;
  private readonly autoCaptureAcquisition: boolean;
  private token: string | null = null;
  private sessionId: string | null = null;
  private sessionReady: Promise<void> | null = null;
  private installCallbacks: InstallAttributionCallback[] = [];
  private storedClickId: string | null = null;

  constructor(config: EventIQNClientConfig) {
    this.apiKey = config.apiKey;
    this.companyId = config.companyId;
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.storageKey = config.storageKey ?? DEFAULT_SESSION_STORAGE_KEY;
    this.skipSession = Boolean(config.skipSession);
    this.initialDevice = config.initialDevice;
    this.autoTrackInstall = config.autoTrackInstall !== false;
    this.autoCaptureAcquisition = config.autoCaptureAcquisition !== false;
    if (this.autoCaptureAcquisition) {
      this.storedClickId = getClickIdFromUrl() ?? getClickIdFromCookie();
    }
  }

  setLoginToken(token: string): void {
    this.token = token;
  }

  onInstallAttribution(callback: InstallAttributionCallback): void {
    this.installCallbacks.push(callback);
  }

  clearSession(): void {
    this.sessionId = null;
    this.sessionReady = null;
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.removeItem(this.storageKey);
        sessionStorage.removeItem(FIRST_OPEN_KEY);
        sessionStorage.removeItem(CLICK_ID_KEY);
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
      const cid = sessionStorage.getItem(CLICK_ID_KEY);
      if (cid) this.storedClickId = cid;
    } catch {
      /* ignore */
    }
  }

  private persistClickId(clickId: string): void {
    this.storedClickId = clickId;
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem(CLICK_ID_KEY, clickId);
      } catch {
        /* ignore */
      }
    }
  }

  private isFirstOpen(): boolean {
    if (typeof sessionStorage === "undefined") return false;
    try {
      return !sessionStorage.getItem(FIRST_OPEN_KEY);
    } catch {
      return false;
    }
  }

  private markFirstOpenSent(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(FIRST_OPEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async ensureSession(): Promise<void> {
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

    if (this.autoCaptureAcquisition) {
      await this.captureAcquisitionContext();
    }

    if (this.autoTrackInstall && this.isFirstOpen()) {
      await this.trackInstall({
        eventId: crypto.randomUUID(),
        occurredAt: new Date().toISOString()
      });
      this.markFirstOpenSent();
    }
  }

  /** Parse URL UTMs / st_click_id and fire a record touchpoint. */
  async captureAcquisitionContext(): Promise<void> {
    const clickId = getClickIdFromUrl() ?? getClickIdFromCookie() ?? this.storedClickId;
    const utm = parseUtmFromUrl();
    if (clickId) this.persistClickId(clickId);
    if (!clickId && !utm) return;

    await this.trackRecord({
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      mediaSource: utm?.source,
      campaignId: utm?.campaign ?? undefined,
      channel: utm?.medium,
      metadata: { clickId, utm, landingUrl: typeof window !== "undefined" ? window.location.href : undefined }
    });
  }

  /** Handle SPA / universal link navigation with campaign params. */
  async handleDeepLink(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    const clickId = parsed.searchParams.get("st_click_id");
    if (clickId) this.persistClickId(clickId);
    const mediaSource = parsed.searchParams.get("pid") ?? parsed.searchParams.get("media_source") ?? undefined;
    const campaignId = parsed.searchParams.get("c") ?? parsed.searchParams.get("campaign") ?? undefined;
    const adgroupId = parsed.searchParams.get("adset") ?? parsed.searchParams.get("af_adset") ?? undefined;
    const creativeId = parsed.searchParams.get("ad") ?? parsed.searchParams.get("af_ad") ?? undefined;
    const deepLinkValue = parsed.searchParams.get("deep_link_value") ?? undefined;

    await this.trackRecord({
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      mediaSource: mediaSource ?? undefined,
      campaignId: campaignId ?? undefined,
      adgroupId: adgroupId ?? undefined,
      creativeId: creativeId ?? undefined,
      landingUrl: url,
      metadata: { clickId, deepLinkValue }
    });
  }

  private recordToken(): string | null {
    if (this.sessionId) return this.sessionId;
    if (this.skipSession) return this.token;
    return null;
  }

  async trackRecord(recordData: Omit<RecordEvent, "actionType" | "companyId">): Promise<Response> {
    await this.ensureSession();
    const t = this.recordToken() ?? recordData.token;
    return this.send({
      ...recordData,
      actionType: "record",
      companyId: this.companyId,
      ...(t ? { token: t } : {})
    } satisfies RecordEvent);
  }

  async trackInstall(
    installData: Omit<InstallEvent, "actionType" | "companyId" | "token">
  ): Promise<InstallAttributionResult> {
    await this.ensureSession();
    const t = this.recordToken();
    if (!t) throw new Error("Session required for install event.");

    const clickId = this.storedClickId ?? getClickIdFromUrl() ?? getClickIdFromCookie() ?? installData.clickId;
    const res = await this.send({
      ...installData,
      actionType: "install",
      companyId: this.companyId,
      token: t,
      clickId: clickId ?? undefined,
      deepLinkUrl: typeof window !== "undefined" ? window.location.href : installData.deepLinkUrl
    } satisfies InstallEvent);

    const body = (await res.json()) as { attribution?: InstallAttributionResult };
    const result: InstallAttributionResult = body.attribution ?? {
      attributed: false,
      isOrganic: true,
      confidence: 0
    };
    for (const cb of this.installCallbacks) {
      cb(result);
    }
    return result;
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

  async trackCustom(
    customData: Omit<CustomEvent, "actionType" | "companyId"> & Record<string, unknown>
  ): Promise<Response> {
    await this.ensureSession();
    const t = this.recordToken() ?? (typeof customData.token === "string" ? customData.token : undefined);
    return this.send({
      ...customData,
      actionType: "custom",
      companyId: this.companyId,
      ...(t ? { token: t } : {})
    });
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

export function init(config: EventIQNClientConfig): EventIQNClient {
  return new EventIQNClient(config);
}

export type { DeviceDetails, UtmParams };
