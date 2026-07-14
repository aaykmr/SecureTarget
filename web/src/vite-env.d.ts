/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_INGEST_URL?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_GOOGLE_SHEETS_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
