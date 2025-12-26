import {
  DEFAULT_SETTINGS,
  MAX_POPUP_RECENT_COUNT,
  MAX_RECENT_WINDOW_SIZE
} from "../../lib/constants"
import type { NcSettings } from "../../lib/types"

export function normalizeSettings(settings: NcSettings): NcSettings {
  return {
    ...settings,
    recentWindowSize: Math.min(
      MAX_RECENT_WINDOW_SIZE,
      Math.max(1, Math.floor(settings.recentWindowSize || 5))
    ),
    popupRecentCount: Math.min(
      MAX_POPUP_RECENT_COUNT,
      Math.max(1, Math.floor(settings.popupRecentCount || 5))
    ),
    overlayAutoCloseMs: Math.min(
      5000,
      Math.max(500, settings.overlayAutoCloseMs || 1500)
    ),
    overlayAndCaptureEnabled:
      settings.overlayAndCaptureEnabled ??
      DEFAULT_SETTINGS.overlayAndCaptureEnabled,
    showEventThumbnails:
      settings.showEventThumbnails ?? DEFAULT_SETTINGS.showEventThumbnails,
    glicko: settings.glicko || DEFAULT_SETTINGS.glicko
  }
}
