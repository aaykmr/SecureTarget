/** Sent on POST /v1/session/bootstrap (validated by ingest; persisted in SecureTarget device DB). Never repeat on later ingest calls. */
export type DevicePlatform = "web" | "ios" | "android";

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

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
  /** IDFA (iOS) or GAID (Android) when user consented */
  advertisingId?: string;
  /** iOS identifierForVendor */
  vendorId?: string;
  /** Android Play Install Referrer string */
  installReferrer?: string;
  /** Deep link / Universal Link URL on cold start */
  deepLinkUrl?: string;
  /** Parsed UTM parameters from landing URL */
  utm?: UtmParams;
  /** Extra non-PII fields */
  metadata?: Record<string, unknown>;
}

export interface SessionBootstrapPayload {
  occurredAt: string;
  device: DeviceDetails;
}
