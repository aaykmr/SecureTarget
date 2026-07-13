"use client";

import { Copy01Icon, Download01Icon } from "@hugeicons/core-free-icons";
import { Link } from "react-router-dom";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./integration-snippets.module.scss";

type Platform = "web" | "ios" | "android";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "ios", label: "iOS" },
  { id: "android", label: "Android" },
];

function CopyCodeBlock({ label, code }: { label: string; code: string }) {
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Could not copy");
    }
  }, [code, label]);

  return (
    <div className={styles.codeBlock}>
      <pre className={styles.pre}>{code}</pre>
      <button type="button" className={styles.copyBtn} onClick={() => void copy()} aria-label={`Copy ${label}`}>
        <HugeIcon icon={Copy01Icon} size={16} />
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className={styles.step}>
      <div className={styles.stepHead}>
        <span className={styles.stepNum}>{n}</span>
        <h4 className={styles.stepTitle}>{title}</h4>
      </div>
      <div className={styles.stepBody}>{children}</div>
    </li>
  );
}

function GenerateApiKeyStep({ n }: { n: number }) {
  return (
    <Step n={n} title="Generate an API key">
      <p>
        Use the <strong>API keys</strong> panel above. Save the full key once — only the prefix is shown later.
        Never commit production keys to git; use env vars or server-side injection.
      </p>
    </Step>
  );
}

function SdkDownload({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a href={href} className={styles.downloadCard} download>
      <span className={styles.downloadText}>
        <span className={styles.downloadLabel}>{label}</span>
        <span className={styles.downloadHint}>{hint}</span>
      </span>
      <HugeIcon icon={Download01Icon} size={18} className={styles.downloadIcon} />
    </a>
  );
}

export function IntegrationSnippets({ companyId, projectId }: { companyId: string; projectId: string }) {
  const [platform, setPlatform] = useState<Platform>("web");

  const ingestDefault = import.meta.env.VITE_INGEST_URL ?? "http://localhost:8080";
  const dashboardDefault = import.meta.env.VITE_APP_URL ?? "";
  const endpoint = ingestDefault.replace(/\/+$/, "");
  const dashboardOrigin = dashboardDefault.replace(/\/+$/, "");
  const llmsUrl = dashboardOrigin ? `${dashboardOrigin}/llms.txt` : "/llms.txt";
  const sdkUrl = dashboardOrigin ? `${dashboardOrigin}/sdk.js` : "/sdk.js";
  const iosSdkZip = dashboardOrigin ? `${dashboardOrigin}/downloads/eventiqn-ios-sdk.zip` : "/downloads/eventiqn-ios-sdk.zip";
  const androidSdkZip = dashboardOrigin
    ? `${dashboardOrigin}/downloads/eventiqn-android-sdk.zip`
    : "/downloads/eventiqn-android-sdk.zip";

  const snippets = useMemo(() => {
    const webNpm = `import { init } from "@eventiqn/web-sdk";

const st = init({
  apiKey: "YOUR_API_KEY",
  companyId: "${companyId}",
  endpoint: "${endpoint}",
});

// Optional — fire after sign-in
await st.trackLogin({
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
});`;

    const webScript = `<script src="${sdkUrl}" async></script>
<script>
  (function () {
    function run() {
      if (!window.EventIQN || !window.EventIQN.init) return;
      window.EventIQN.init({
        apiKey: "YOUR_API_KEY",
        companyId: "${companyId}",
        endpoint: "${endpoint}",
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  })();
</script>`;

    const iosInit = `import EventIQNSDK

let sdk = EventIQNSDK(config: EventIQNConfig(
  apiKey: "YOUR_API_KEY",
  companyId: "${companyId}",
  endpoint: URL(string: "${endpoint}")!
))

// In App init or .task — bootstraps session + first-open install
Task {
  try await sdk.bootstrapSession()
}`;

    const iosDeepLink = `// SwiftUI — .onOpenURL
func handle(url: URL) {
  Task {
    try? await sdk.handleDeepLink(url: url)
  }
}

sdk.onInstallAttribution { result in
  print("Attributed:", result.attributed, result.mediaSource ?? "")
}`;

    const androidInit = `val sdk = EventIQNSdk(
  applicationContext,
  EventIQNConfig(
    apiKey = "YOUR_API_KEY",
    companyId = "${companyId}",
    endpoint = "${endpoint}"
  )
)

// Application.onCreate — session + deferred install referrer
sdk.ensureSession { error ->
  if (error != null) Log.e("EventIQN", "bootstrap failed", error)
}`;

    const androidDeepLink = `// Activity — onCreate / onNewIntent
sdk.handleDeepLink(intent) { error ->
  if (error != null) Log.e("EventIQN", "deep link failed", error)
}

sdk.onInstallAttribution { result ->
  Log.d("EventIQN", "mediaSource=\${result.mediaSource}")
}`;

    const androidConversion = `sdk.trackConversion(
  eventId = UUID.randomUUID().toString(),
  occurredAt = Instant.now().toString(),
  conversionName = "purchase",
  value = 29.99
) { error ->
  if (error != null) Log.e("EventIQN", "conversion failed", error)
}`;

    return { webNpm, webScript, iosInit, iosDeepLink, androidInit, androidDeepLink, androidConversion };
  }, [companyId, endpoint, sdkUrl]);

  const projectContext = useMemo(
    () =>
      [
        "EventIQN integration context",
        "",
        `companyId: ${companyId}`,
        `ingest endpoint: ${endpoint}`,
        "",
        "Checklist:",
        "1. Generate an API key in the API keys panel above (shown once).",
        "2. Set x-api-key header on SDK / ingest requests.",
        "3. Initialize the SDK with apiKey, companyId, and endpoint.",
        "4. Verify events in the dashboard Events view.",
        "",
        `Public agent doc: ${llmsUrl}`,
      ].join("\n"),
    [companyId, endpoint, llmsUrl],
  );

  const openLlmsTxt = useCallback(() => {
    window.open(llmsUrl, "_blank", "noopener,noreferrer");
  }, [llmsUrl]);

  const copyProjectContext = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(projectContext);
      toast.success("Copied project context");
    } catch {
      toast.error("Could not copy");
    }
  }, [projectContext]);

  return (
    <div className={styles.root}>
      <section className={styles.config}>
        <h3 className={styles.configTitle}>Shared configuration</h3>
        <dl className={styles.configGrid}>
          <div className={styles.configItem}>
            <dt>Ingest base URL</dt>
            <dd>
              <code>{endpoint}</code>
            </dd>
          </div>
          <div className={styles.configItem}>
            <dt>companyId</dt>
            <dd>
              <code>{companyId}</code>
            </dd>
          </div>
          <div className={styles.configItem}>
            <dt>API key</dt>
            <dd>
              <code>x-api-key</code> header — copy from <strong>API keys</strong> above
            </dd>
          </div>
          {platform === "web" ? (
            <div className={styles.configItem}>
              <dt>Hosted SDK</dt>
              <dd>
                <code>{sdkUrl}</code>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className={styles.aiSection}>
        <h3 className={styles.configTitle}>AI integration</h3>
        <p className={styles.aiLead}>
          Share stable docs and your project context with coding agents. API keys are never included — generate one in
          the panel above.
        </p>
        <div className={styles.aiActions}>
          <button type="button" className={styles.aiBtn} onClick={openLlmsTxt}>
            Open llms.txt
          </button>
          <button type="button" className={styles.aiBtn} onClick={() => void copyProjectContext()}>
            Copy project context
          </button>
        </div>
      </section>

      <div className={styles.tabBar} role="tablist" aria-label="Integration platform">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={platform === p.id}
            className={platform === p.id ? styles.tabActive : styles.tab}
            onClick={() => setPlatform(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {platform === "web" ? (
        <ol className={styles.steps}>
          <GenerateApiKeyStep n={1} />
          <Step n={2} title="Choose how to load the Web SDK">
            <p>
              <strong>Script tag</strong> — any HTML site or CMS; load <code>{sdkUrl}</code>.
            </p>
            <p>
              <strong>npm / bundler</strong> — React, Next.js, Vite in this monorepo via{" "}
              <code>@eventiqn/web-sdk</code>.
            </p>
          </Step>
          <Step n={3} title="Initialize on your landing page">
            <p>Pick one approach:</p>
            <p className={styles.optionLabel}>Script tag</p>
            <CopyCodeBlock label="Web script tag snippet" code={snippets.webScript} />
            <p className={styles.optionLabel}>npm / bundler</p>
            <CopyCodeBlock label="Web npm snippet" code={snippets.webNpm} />
            <p className={styles.hint}>
              On first load the SDK bootstraps a session, auto-captures <code>st_click_id</code> / UTMs from the URL
              (campaign links), and can auto-fire a first-open install on web.
            </p>
          </Step>
          <Step n={4} title="Wire campaign traffic (optional)">
            <p>
              Create a tracking link under{" "}
              <Link to={`/dashboard/${projectId}/links`} className={styles.inlineLink}>
                Links
              </Link>
              . Use that URL as your ad destination — clicks redirect to your site with{" "}
              <code>st_click_id</code> and <code>pid</code> / <code>c</code> params.
            </p>
          </Step>
          <Step n={5} title="Verify events">
            <p>
              Open{" "}
              <Link to={`/dashboard/${projectId}/events`} className={styles.inlineLink}>
                Events
              </Link>{" "}
              and filter by action type <code>record</code> or <code>login</code>. Confirm ingest URL and API key
              pepper match between dashboard and backend (<code>API_KEY_PEPPER</code>).
            </p>
          </Step>
        </ol>
      ) : null}

      {platform === "ios" ? (
        <ol className={styles.steps}>
          <GenerateApiKeyStep n={1} />
          <Step n={2} title="Download the iOS SDK">
            <p>Unzip and add the Swift sources to your Xcode project, or add the folder as a local Swift package.</p>
            <SdkDownload
              href={iosSdkZip}
              label="Download eventiqn-ios-sdk.zip"
              hint="EventIQNSDK.swift + README"
            />
          </Step>
          <Step n={3} title="Add sources to your app">
            <p>
              Drag <code>EventIQNSDK/EventIQNSDK.swift</code> into your target, or use File → Add Package
              Dependencies → Add Local… and point at the unzipped folder.
            </p>
          </Step>
          <Step n={4} title="Configure credentials">
            <p>
              Use your API key, <code>companyId</code>, and ingest URL. Request App Tracking Transparency before reading
              IDFA if your policy requires it.
            </p>
            <CopyCodeBlock label="iOS init snippet" code={snippets.iosInit} />
          </Step>
          <Step n={5} title="Bootstrap session on launch">
            <p>
              Call <code>bootstrapSession()</code> early. The SDK persists <code>sessionId</code>, sends{" "}
              <code>x-session-id</code> on every event, and auto-fires a first-open <code>install</code> event once.
            </p>
          </Step>
          <Step n={6} title="Handle universal links & deep links">
            <p>
              Forward opened URLs so campaign params (<code>st_click_id</code>, <code>pid</code>, <code>c</code>) are
              recorded.
            </p>
            <CopyCodeBlock label="iOS deep link snippet" code={snippets.iosDeepLink} />
          </Step>
          <Step n={7} title="Track conversions">
            <p>After login or purchase in your app:</p>
            <CopyCodeBlock
              label="iOS conversion snippet"
              code={`try await sdk.trackConversion(
  eventId: UUID().uuidString,
  occurredAt: ISO8601DateFormatter().string(from: Date()),
  conversionName: "purchase",
  value: 29.99
)`}
            />
          </Step>
          <Step n={8} title="Verify install attribution">
            <p>
              Check{" "}
              <Link to={`/dashboard/${projectId}/events`} className={styles.inlineLink}>
                Events
              </Link>{" "}
              for <code>install</code> events and{" "}
              <Link to={`/dashboard/${projectId}/attribution`} className={styles.inlineLink}>
                Attribution
              </Link>{" "}
              after clicking a{" "}
              <Link to={`/dashboard/${projectId}/links`} className={styles.inlineLink}>
                tracking link
              </Link>{" "}
              before install.
            </p>
          </Step>
        </ol>
      ) : null}

      {platform === "android" ? (
        <ol className={styles.steps}>
          <GenerateApiKeyStep n={1} />
          <Step n={2} title="Download the Android SDK">
            <p>
              Unzip and copy the Kotlin sources into your app module. The zip includes a README with the Gradle
              dependency for Play Install Referrer.
            </p>
            <SdkDownload
              href={androidSdkZip}
              label="Download eventiqn-android-sdk.zip"
              hint="EventIQNSdk.kt, InstallReferrerHelper.kt + README"
            />
          </Step>
          <Step n={3} title="Add sources and Gradle dependency">
            <p>
              Copy <code>src/main/java/com/eventiqn/sdk/*.kt</code> into your app. Add{" "}
              <code>implementation &quot;com.android.installreferrer:installreferrer:2.2&quot;</code> to{" "}
              <code>app/build.gradle</code>.
            </p>
          </Step>
          <Step n={4} title="Configure credentials">
            <CopyCodeBlock label="Android init snippet" code={snippets.androidInit} />
          </Step>
          <Step n={5} title="Bootstrap session on app start">
            <p>
              <code>ensureSession()</code> calls <code>/v1/session/bootstrap</code>, reads the Install Referrer when
              available, and sends a first-open <code>install</code> event automatically.
            </p>
          </Step>
          <Step n={6} title="Handle deep links">
            <p>Pass the launch intent so <code>st_click_id</code> and campaign query params are captured.</p>
            <CopyCodeBlock label="Android deep link snippet" code={snippets.androidDeepLink} />
          </Step>
          <Step n={7} title="Track conversions">
            <CopyCodeBlock label="Android conversion snippet" code={snippets.androidConversion} />
          </Step>
          <Step n={8} title="Use Play Store tracking links">
            <p>
              Set your Android store URL on a{" "}
              <Link to={`/dashboard/${projectId}/links`} className={styles.inlineLink}>
                tracking link
              </Link>
              . EventIQN appends <code>referrer=st_click_id=…</code> to the Play Store URL; the SDK reads it on first
              open.
            </p>
          </Step>
          <Step n={9} title="Verify events">
            <p>
              Open{" "}
              <Link to={`/dashboard/${projectId}/events`} className={styles.inlineLink}>
                Events
              </Link>{" "}
              and{" "}
              <Link to={`/dashboard/${projectId}/attribution`} className={styles.inlineLink}>
                Attribution
              </Link>{" "}
              after a test install.
            </p>
          </Step>
        </ol>
      ) : null}
    </div>
  );
}
