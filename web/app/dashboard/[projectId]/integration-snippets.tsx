import clsx from "clsx";
import styles from "./integration-snippets.module.scss";

const ingestDefault = process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:8080";
const dashboardDefault = process.env.NEXT_PUBLIC_APP_URL ?? "";

export function IntegrationSnippets({ companyId }: { companyId: string }) {
  const endpoint = ingestDefault.replace(/\/+$/, "");
  const dashboardOrigin = dashboardDefault.replace(/\/+$/, "");
  const sdkUrl = dashboardOrigin ? `${dashboardOrigin}/sdk.js` : "/sdk.js";

  const sdkSnippet = `import { init } from "@securetarget/web-sdk";

const st = init({
  apiKey: process.env.NEXT_PUBLIC_ST_API_KEY!,
  companyId: "${companyId}",
  endpoint: "${endpoint}",
});`;

  const scriptSnippet = `<!-- Hosted SDK from your dashboard (set NEXT_PUBLIC_APP_URL in .env for the full script URL) -->
<script src="${sdkUrl}" async></script>
<script>
  (function () {
    function run() {
      if (!window.SecureTarget || !window.SecureTarget.init) return;
      var st = window.SecureTarget.init({
        apiKey: "YOUR_API_KEY",
        companyId: "${companyId}",
        endpoint: "${endpoint}"
      });
      // Example: st.trackRecord({ eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  })();
</script>`;

  return (
    <div className={styles.root}>
      <div>
        <h3 className={styles.blockTitle}>Hosted browser SDK</h3>
        <p className={styles.blockLead}>
          Static file served by this app at <code className={styles.monoInline}>/sdk.js</code>
          {dashboardOrigin ? ` (absolute: ${sdkUrl})` : ". Set NEXT_PUBLIC_APP_URL for copy-paste URLs."}
        </p>
      </div>
      <div>
        <h3 className={styles.blockTitle}>Ingest base URL</h3>
        <code className={styles.endpoint}>{endpoint}</code>
      </div>
      <div>
        <h3 className={styles.blockTitle}>Bundler / npm (monorepo)</h3>
        <pre className={styles.pre}>{sdkSnippet}</pre>
      </div>
      <div>
        <h3 className={styles.blockTitle}>Script tag (hosted sdk.js)</h3>
        <pre className={clsx(styles.pre, styles.preTall)}>{scriptSnippet}</pre>
      </div>
    </div>
  );
}
