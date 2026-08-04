/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the backend lives; same-origin "/api" by default */
  readonly VITE_API_URL?: string
  /** "http" (default) or "sample" — see src/lib/api/index.ts */
  readonly VITE_DATA_SOURCE?: "http" | "sample"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
