import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "better-sqlite3";
import { getAttributionSettings } from "../services/trackingLinks.js";

export function handleAppleAppSiteAssociation(
  req: IncomingMessage,
  res: ServerResponse,
  customerDb: Database,
  companyId: string
): void {
  const settings = getAttributionSettings(customerDb, companyId);
  if (!settings.iosAppId || !settings.iosTeamId) {
    res.statusCode = 404;
    res.end("Not configured");
    return;
  }
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${settings.iosTeamId}.${settings.iosAppId}`,
          paths: ["/v1/l/*", "/l/*"]
        }
      ]
    }
  };
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function handleAssetLinks(
  req: IncomingMessage,
  res: ServerResponse,
  customerDb: Database,
  companyId: string
): void {
  const settings = getAttributionSettings(customerDb, companyId);
  if (!settings.androidPackage || settings.androidSha256Certs.length === 0) {
    res.statusCode = 404;
    res.end("Not configured");
    return;
  }
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: settings.androidPackage,
        sha256_cert_fingerprints: settings.androidSha256Certs
      }
    }
  ];
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
