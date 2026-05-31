/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDBASE_ENV?: string
  readonly VITE_CLOUDBASE_TRANSPORT?: string
  // Optional overrides for the desktop-preview quick-experience demo accounts.
  readonly VITE_DEMO_DISABLED_EMAIL?: string
  readonly VITE_DEMO_VOLUNTEER_EMAIL?: string
  readonly VITE_DEMO_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
