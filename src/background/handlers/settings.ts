import type { NcSettings } from "../../lib/types"
import { getStorageData, setStorageData } from "../services/storage"
import { normalizeSettings } from "../utils/normalize"
import { rebuildRatingsFromEvents } from "../utils/rating-helpers"
import { rebuildRecentWindowFromEvents } from "../utils/recent-window"

export async function handleToggleOverlay(enabled: boolean) {
  const { settings } = await getStorageData(["settings"])

  if (settings.overlayAndCaptureEnabled === enabled) {
    return
  }

  await setStorageData({
    settings: {
      ...settings,
      overlayAndCaptureEnabled: enabled
    }
  })
}

export async function handleUpdateSettings(partial: Partial<NcSettings>) {
  const {
    settings: currentSettings,
    events,
    state,
    videos
  } = await getStorageData(["settings", "events", "state", "videos"])
  const nextSettings = normalizeSettings({ ...currentSettings, ...partial })
  const updates: Parameters<typeof setStorageData>[0] = {
    settings: nextSettings
  }

  if (nextSettings.recentWindowSize !== currentSettings.recentWindowSize) {
    updates.state = {
      ...state,
      recentWindow: rebuildRecentWindowFromEvents(
        events.items,
        nextSettings.recentWindowSize,
        videos
      )
    }
  }

  if (
    nextSettings.glicko.rating !== currentSettings.glicko.rating ||
    nextSettings.glicko.rd !== currentSettings.glicko.rd ||
    nextSettings.glicko.volatility !== currentSettings.glicko.volatility
  ) {
    updates.ratings = rebuildRatingsFromEvents(events.items, nextSettings)
  }

  await setStorageData(updates)
}
