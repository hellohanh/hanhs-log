/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Build-time settings, filled from GitHub Secrets by the deploy and
// preview workflows. Any of them can be empty in a local or test build.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_GOOGLE_MAP_ID?: string
  readonly VITE_GOOGLE_MAP_ID_NOPINS?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
