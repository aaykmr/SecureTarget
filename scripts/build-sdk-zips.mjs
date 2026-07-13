#!/usr/bin/env node
/**
 * Packages iOS and Android SDK sources into zip archives for dashboard download.
 * Output: web/public/downloads/eventiqn-{ios,android}-sdk.zip
 */
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "web", "public", "downloads");
const version = readRootVersion();

function readRootVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function zipStaging(stagingDir, zipPath, entries) {
  execSync(`zip -rq "${zipPath}" ${entries.join(" ")}`, { cwd: stagingDir, stdio: "inherit" });
}

function buildIosZip() {
  const staging = mkdtempSync(join(root, ".sdk-zip-ios-"));
  const bundleDir = join(staging, "EventIQNSDK");
  mkdirSync(bundleDir, { recursive: true });

  cpSync(join(root, "sdk/ios/Sources/EventIQNSDK/EventIQNSDK.swift"), join(bundleDir, "EventIQNSDK.swift"));

  writeFileSync(
    join(staging, "README.md"),
    `# EventIQN iOS SDK v${version}

## Install

1. Unzip and drag the \`EventIQNSDK\` folder into your Xcode project (copy items if needed).
2. Or add the folder as a local Swift package: File → Add Package Dependencies → Add Local…

## Configure

\`\`\`swift
import EventIQNSDK

let sdk = EventIQNSDK(config: EventIQNConfig(
  apiKey: "YOUR_API_KEY",
  companyId: "YOUR_COMPANY_ID",
  endpoint: URL(string: "https://your-ingest-host.example.com")!
))

Task {
  try await sdk.bootstrapSession()
}
\`\`\`

## Docs

See your EventIQN dashboard → Integration → iOS for deep links, install attribution, and conversions.
`,
    "utf8"
  );

  const zipPath = join(outDir, "eventiqn-ios-sdk.zip");
  zipStaging(staging, zipPath, ["EventIQNSDK", "README.md"]);
  rmSync(staging, { recursive: true, force: true });
  console.log(`[build:sdk-zips] ${zipPath}`);
}

function buildAndroidZip() {
  const staging = mkdtempSync(join(root, ".sdk-zip-android-"));
  const srcDir = join(staging, "src", "main", "java", "com", "eventiqn", "sdk");
  mkdirSync(srcDir, { recursive: true });

  const androidSdk = join(root, "sdk/android/src/main/java/com/eventiqn/sdk");
  cpSync(join(androidSdk, "EventIQNSdk.kt"), join(srcDir, "EventIQNSdk.kt"));
  cpSync(join(androidSdk, "InstallReferrerHelper.kt"), join(srcDir, "InstallReferrerHelper.kt"));

  writeFileSync(
    join(staging, "README.md"),
    `# EventIQN Android SDK v${version}

## Install

1. Unzip and copy \`src/main/java/com/eventiqn/sdk/*.kt\` into your app module (same package path).
2. Add the Play Install Referrer library to \`app/build.gradle\`:

\`\`\`gradle
dependencies {
  implementation "com.android.installreferrer:installreferrer:2.2"
}
\`\`\`

## Configure

\`\`\`kotlin
val sdk = EventIQNSdk(
  applicationContext,
  EventIQNConfig(
    apiKey = "YOUR_API_KEY",
    companyId = "YOUR_COMPANY_ID",
    endpoint = "https://your-ingest-host.example.com"
  )
)

sdk.ensureSession { error ->
  if (error != null) Log.e("EventIQN", "bootstrap failed", error)
}
\`\`\`

## Docs

See your EventIQN dashboard → Integration → Android for deep links, Play Store attribution, and conversions.
`,
    "utf8"
  );

  const zipPath = join(outDir, "eventiqn-android-sdk.zip");
  zipStaging(staging, zipPath, ["src", "README.md"]);
  rmSync(staging, { recursive: true, force: true });
  console.log(`[build:sdk-zips] ${zipPath}`);
}

mkdirSync(outDir, { recursive: true });
buildIosZip();
buildAndroidZip();
