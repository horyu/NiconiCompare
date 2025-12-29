import { normalizeCategories } from "../../lib/categories"
import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import { readAllStorage, setStorageData } from "../services/storage"
import { normalizeSettings } from "../utils/normalize"

export async function readStateSnapshot() {
  try {
    const data = await readAllStorage()
    const settings = normalizeSettings(data.settings)
    const state = data.state
    const videos = data.videos
    const events = data.events
    const ratings = data.ratings
    const meta = data.meta
    const authors = data.authors
    const categories = normalizeCategories(data.categories)

    let normalizedState = state
    if (state.pinnedOpponentVideoId && !videos[state.pinnedOpponentVideoId]) {
      normalizedState = {
        ...state,
        pinnedOpponentVideoId: undefined
      }
      await setStorageData({ state: normalizedState })
    }

    return {
      settings,
      state: normalizedState,
      events,
      ratings,
      meta,
      videos,
      authors,
      categories
    }
  } catch (error) {
    console.warn("Failed to read state snapshot:", error)
    return {
      settings: DEFAULT_SETTINGS,
      state: DEFAULT_STATE,
      events: DEFAULT_EVENTS_BUCKET,
      ratings: {},
      meta: DEFAULT_META,
      videos: {},
      authors: {},
      categories: DEFAULT_CATEGORIES
    }
  }
}
