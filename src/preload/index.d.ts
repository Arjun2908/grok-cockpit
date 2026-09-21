import type { CockpitAPI } from './index'

declare global {
  interface Window {
    api: CockpitAPI
  }
}

export {}
