export type ISODateString = string;

/** Discriminator for `POST /v1/record` payloads */
export type IngestActionType = "record" | "login" | "conversion" | "custom";

export interface BaseEvent {
  eventId: string;
  companyId: string;
  occurredAt: ISODateString;
}

/** First touch / campaign record (stored in `click_events` + `sdk_events`). */
export interface RecordEvent extends BaseEvent {
  actionType: "record";
  token?: string;
  campaignId?: string;
  adgroupId?: string;
  creativeId?: string;
  channel?: string;
  landingUrl?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

export interface LoginEvent extends BaseEvent {
  actionType: "login";
  token: string;
  expiresAt?: ISODateString;
}

export interface ConversionEvent extends BaseEvent {
  actionType: "conversion";
  token: string;
  conversionName: string;
  value?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

/** Arbitrary product/analytics events (views, screens, etc.). Stored only in `sdk_events`, not in `click_events`. */
export interface CustomEvent extends BaseEvent {
  actionType: "custom";
  token?: string;
}

export type IngestEvent = RecordEvent | LoginEvent | ConversionEvent | CustomEvent;

function isIsoDate(value: unknown): value is ISODateString {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasBaseFields(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.eventId === "string" &&
    typeof payload.companyId === "string" &&
    isIsoDate(payload.occurredAt)
  );
}

export function isRecordEvent(payload: unknown): payload is RecordEvent {
  if (!isObject(payload) || payload.actionType !== "record" || !hasBaseFields(payload)) {
    return false;
  }
  if (payload.metadata !== undefined && !isObject(payload.metadata)) {
    return false;
  }
  if (payload.token !== undefined && (typeof payload.token !== "string" || payload.token.length === 0)) {
    return false;
  }
  return true;
}

export function isLoginEvent(payload: unknown): payload is LoginEvent {
  if (!isObject(payload) || payload.actionType !== "login" || !hasBaseFields(payload)) {
    return false;
  }
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    return false;
  }
  if (payload.expiresAt !== undefined && !isIsoDate(payload.expiresAt)) {
    return false;
  }
  return true;
}

export function isConversionEvent(payload: unknown): payload is ConversionEvent {
  if (!isObject(payload) || payload.actionType !== "conversion" || !hasBaseFields(payload)) {
    return false;
  }
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    return false;
  }
  if (typeof payload.conversionName !== "string" || payload.conversionName.length === 0) {
    return false;
  }
  if (payload.metadata !== undefined && !isObject(payload.metadata)) {
    return false;
  }
  return true;
}

export function isCustomEvent(payload: unknown): payload is CustomEvent {
  if (!isObject(payload) || payload.actionType !== "custom" || !hasBaseFields(payload)) {
    return false;
  }
  if (payload.token !== undefined && (typeof payload.token !== "string" || payload.token.length === 0)) {
    return false;
  }
  return true;
}

export function validateIngestEvent(payload: unknown): IngestEvent {
  if (isRecordEvent(payload) || isLoginEvent(payload) || isConversionEvent(payload) || isCustomEvent(payload)) {
    return payload;
  }
  throw new Error("Invalid ingest event payload (expected actionType record | login | conversion | custom)");
}
