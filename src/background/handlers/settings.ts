import type { NcSettings } from "../../lib/types"
import type { StorageDataByKey } from "../services/storage"
import { withStorageUpdates } from "../services/storage"
import { normalizeSettings } from "../utils/normalize"
import { rebuildRatingsFromEvents } from "../utils/ratingHelpers"
import { rebuildRecentWindowFromEvents } from "../utils/recentWindow"

export async function handleToggleOverlay(enabled: boolean): Promise<void> {
  await withStorageUpdates({
    keys: ["settings"],
    context: "bg:settings:toggleOverlay",
    update: ({ settings }) => {
      if (settings.overlayAndCaptureEnabled === enabled) {
        return { updates: {} }
      }
      return {
        updates: {
          settings: {
            ...settings,
            overlayAndCaptureEnabled: enabled
          }
        }
      }
    }
  })
}

export async function handleUpdateSettings(
  partial: Partial<NcSettings>
): Promise<void> {
  await withStorageUpdates({
    keys: ["settings", "events", "state", "videos"],
    context: "bg:settings:update",
    update: ({ settings: currentSettings, events, state, videos }) => {
      const nextSettings = normalizeSettings({ ...currentSettings, ...partial })
      const updates: Partial<StorageDataByKey> = {
        settings: nextSettings
      }

      if (nextSettings.recentWindowSize !== currentSettings.recentWindowSize) {
        updates.state = {
          ...state,
          recentWindow: rebuildRecentWindowFromEvents(
            events.items,
            nextSettings.recentWindowSize,
            videos,
            state.currentVideoId
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

      return { updates }
    }
  })
}
