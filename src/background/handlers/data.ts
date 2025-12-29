import { normalizeCategories } from "../../lib/categories"
import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  STORAGE_KEYS
} from "../../lib/constants"
import type {
  NcAuthors,
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcSettings,
  NcState,
  NcVideos,
  StorageShape
} from "../../lib/types"
import { readAllStorage, setStorageData } from "../services/storage"
import { normalizeSettings } from "../utils/normalize"
import { rebuildRatingsFromEvents } from "../utils/rating-helpers"
import { rebuildRecentWindowFromEvents } from "../utils/recent-window"

export async function handleDeleteAllData() {
  await setStorageData({
    settings: DEFAULT_SETTINGS,
    state: DEFAULT_STATE,
    events: DEFAULT_EVENTS_BUCKET,
    meta: DEFAULT_META,
    videos: {},
    authors: {},
    ratings: {},
    categories: DEFAULT_CATEGORIES
  })
}

export async function handleExportData() {
  try {
    const data = await readAllStorage()
    return {
      [STORAGE_KEYS.settings]: data.settings,
      [STORAGE_KEYS.state]: data.state,
      [STORAGE_KEYS.videos]: data.videos,
      [STORAGE_KEYS.authors]: data.authors,
      [STORAGE_KEYS.events]: data.events,
      [STORAGE_KEYS.ratings]: data.ratings,
      [STORAGE_KEYS.meta]: data.meta,
      [STORAGE_KEYS.categories]: data.categories
    }
  } catch (error) {
    console.warn("chrome.storage.local is unavailable.", error)
    return {
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.state]: DEFAULT_STATE,
      [STORAGE_KEYS.videos]: {},
      [STORAGE_KEYS.authors]: {},
      [STORAGE_KEYS.events]: DEFAULT_EVENTS_BUCKET,
      [STORAGE_KEYS.ratings]: {},
      [STORAGE_KEYS.meta]: DEFAULT_META,
      [STORAGE_KEYS.categories]: DEFAULT_CATEGORIES
    }
  }
}

export async function handleImportData(data: Partial<StorageShape>) {
  const nextSettings = normalizeSettings(
    (data[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  )
  const nextEvents =
    (data[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const nextState = (data[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE
  const rawMeta = (data[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  const nextMeta: NcMeta = {
    ...DEFAULT_META,
    ...rawMeta,
    lastCleanupAt: Number(rawMeta.lastCleanupAt ?? 0)
  }
  const nextVideos = (data[STORAGE_KEYS.videos] as NcVideos) ?? {}
  const nextAuthors = (data[STORAGE_KEYS.authors] as NcAuthors) ?? {}
  const nextCategories = normalizeCategories(
    (data[STORAGE_KEYS.categories] as NcCategories) ?? DEFAULT_CATEGORIES
  )

  const eventItems = Array.isArray(nextEvents.items)
    ? nextEvents.items.map((event) => ({
        ...event,
        categoryId: event.categoryId ?? nextCategories.defaultId
      }))
    : []
  const maxEventId = eventItems.reduce(
    (max, event) => Math.max(max, event.id),
    0
  )
  const normalizedEvents: NcEventsBucket = {
    items: eventItems,
    nextId: Math.max(nextEvents.nextId ?? 0, maxEventId + 1, 1)
  }
  const normalizedMeta: NcMeta = nextMeta

  const rebuiltState: NcState = {
    ...nextState,
    recentWindow: rebuildRecentWindowFromEvents(
      normalizedEvents.items,
      nextSettings.recentWindowSize,
      nextVideos
    )
  }
  const normalizedSettings: NcSettings = {
    ...nextSettings,
    activeCategoryId: nextSettings.activeCategoryId || nextCategories.defaultId
  }
  const nextRatings = rebuildRatingsFromEvents(
    normalizedEvents.items,
    normalizedSettings
  )

  await setStorageData({
    settings: normalizedSettings,
    state: rebuiltState,
    events: normalizedEvents,
    meta: normalizedMeta,
    videos: nextVideos,
    authors: nextAuthors,
    ratings: nextRatings,
    categories: nextCategories
  })
}
