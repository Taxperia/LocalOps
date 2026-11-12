import type { LocalOpsApi } from '../../preload/index'

declare global {
  interface Window {
    localops: LocalOpsApi
  }
}

export {}
