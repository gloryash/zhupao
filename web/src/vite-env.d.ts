/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDBASE_ENV?: string
  readonly VITE_CLOUDBASE_TRANSPORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
