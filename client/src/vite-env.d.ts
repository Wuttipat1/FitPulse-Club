/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full API base, e.g. https://fitpulse-api.onrender.com/api (unset in local dev) */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
