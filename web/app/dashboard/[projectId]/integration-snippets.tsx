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
      // Example: st.trackClick({ eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  })();
</script>`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Hosted browser SDK</h3>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Static file served by this app at <code className="font-mono">/sdk.js</code>
          {dashboardOrigin ? ` (absolute: ${sdkUrl})` : ". Set NEXT_PUBLIC_APP_URL for copy-paste URLs."}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Ingest base URL</h3>
        <code className="mt-1 block rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          {endpoint}
        </code>
      </div>
      <div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Bundler / npm (monorepo)</h3>
        <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-zinc-100 p-3 text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          {sdkSnippet}
        </pre>
      </div>
      <div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Script tag (hosted sdk.js)</h3>
        <pre className="mt-1 max-h-96 overflow-auto rounded-md bg-zinc-100 p-3 text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          {scriptSnippet}
        </pre>
      </div>
    </div>
  );
}
