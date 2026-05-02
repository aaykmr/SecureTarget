/** Sent on POST /v1/session/bootstrap (validated by ingest; not persisted—only opaque session id is stored server-side). Never repeat on later ingest calls. */
export type DevicePlatform = "web" | "ios" | "android";

export interface DeviceDetails {
  platform: DevicePlatform;
  /** OS / browser version when applicable */
  osVersion?: string;
  /** Device or browser model name */
  model?: string;
  locale?: string;
  timezone?: string;
  screenWidth?: number;
  screenHeight?: number;
  pixelRatio?: number;
  userAgent?: string;
  manufacturer?: string;
  appVersion?: string;
  sdkVersion?: string;
  language?: string;
  hardwareConcurrency?: number;
  /** Extra non-PII fields */
  metadata?: Record<string, unknown>;
}

export interface SessionBootstrapPayload {
  occurredAt: string;
  device: DeviceDetails;
}
