/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_PUBLIC_KEEP_OVERLAY_OPEN?: string
  readonly WXT_PUBLIC_NC_LOG_LEVEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
