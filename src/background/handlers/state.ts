import { normalizeCategories } from "../../lib/categories"
import { logger } from "../../lib/logger"
import type { StorageDataByKey } from "../services/storage"
import { withStorageUpdates } from "../services/storage"
import { normalizeSettings } from "../utils/normalize"

export async function readStateSnapshot(): Promise<StorageDataByKey> {
  const snapshot = await withStorageUpdates({
    keys: [
      "settings",
      "state",
      "videos",
      "authors",
      "events",
      "ratings",
      "meta",
      "categories"
    ],
    context: "bg:state:read",
    update: (data) => {
      const settings = normalizeSettings(data.settings)
      const { state, videos, events, ratings, meta, authors } = data
      const categories = normalizeCategories(data.categories)
      logger.debug("[bg:state:read] snapshot counts", {
        events: events.items.length,
        videos: Object.keys(videos).length,
        authors: Object.keys(authors).length,
        categories: Object.keys(categories.items).length
      })

      let normalizedState: typeof state = {
        ...state,
        currentVideoId: state.currentVideoId ?? "",
        pinnedOpponentVideoId: state.pinnedOpponentVideoId ?? ""
      }
      const updates: Partial<StorageDataByKey> = {}
      if (
        normalizedState.pinnedOpponentVideoId &&
        !videos[normalizedState.pinnedOpponentVideoId]
      ) {
        logger.debug("[bg:state:read] clear missing pinned opponent")
        normalizedState = {
          ...normalizedState,
          pinnedOpponentVideoId: ""
        }
        updates.state = normalizedState
      }

      return {
        updates,
        result: {
          settings,
          state: normalizedState,
          events,
          ratings,
          meta,
          videos,
          authors,
          categories
        }
      }
    }
  })
  if (!snapshot) {
    throw new Error("Failed to read state snapshot")
  }
  return snapshot
}
