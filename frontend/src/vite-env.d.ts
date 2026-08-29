/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VARIANT?: 'public' | 'admin'
  readonly VITE_DGIS_ENABLED?: string
  readonly VITE_DGIS_MAPGL_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
