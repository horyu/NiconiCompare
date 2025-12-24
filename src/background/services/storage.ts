import {
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  STORAGE_KEYS
} from "../../lib/constants"
import type {
  NcAuthors,
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos
} from "../../lib/types"

export type StorageDataByKey = {
  settings: NcSettings
  state: NcState
  videos: NcVideos
  authors: NcAuthors
  events: NcEventsBucket
  ratings: NcRatings
  meta: NcMeta
}

export type StorageKey = keyof StorageDataByKey

const DEFAULT_BY_KEY: StorageDataByKey = {
  settings: DEFAULT_SETTINGS,
  state: DEFAULT_STATE,
  videos: {},
  authors: {},
  events: DEFAULT_EVENTS_BUCKET,
  ratings: {},
  meta: DEFAULT_META
}

const ALL_STORAGE_KEYS: StorageKey[] = [
  "settings",
  "state",
  "videos",
  "authors",
  "events",
  "ratings",
  "meta"
]

function ensureStorageAvailable(): chrome.storage.LocalStorageArea {
  const storage = chrome?.storage?.local
  if (!storage) {
    throw new Error("chrome.storage.local is unavailable")
  }
  return storage
}

export async function getStorageData<K extends StorageKey>(
  keys: K[]
): Promise<Pick<StorageDataByKey, K>> {
  const storage = ensureStorageAvailable()
  const storageKeys = keys.map((key) => STORAGE_KEYS[key])
  const result = await storage.get(storageKeys)

  const data = {} as Pick<StorageDataByKey, K>
  for (const key of keys) {
    const storageKey = STORAGE_KEYS[key]
    const value = result[storageKey]
    data[key] = (value ?? DEFAULT_BY_KEY[key]) as StorageDataByKey[K]
  }

  return data
}

export async function getRawStorageData<K extends StorageKey>(
  keys: K[]
): Promise<Partial<Pick<StorageDataByKey, K>>> {
  const storage = ensureStorageAvailable()
  const storageKeys = keys.map((key) => STORAGE_KEYS[key])
  const result = await storage.get(storageKeys)

  const data = {} as Partial<Pick<StorageDataByKey, K>>
  for (const key of keys) {
    const storageKey = STORAGE_KEYS[key]
    const value = result[storageKey]
    if (value !== undefined) {
      data[key] = value as StorageDataByKey[K]
    }
  }

  return data
}

export async function setStorageData(
  updates: Partial<StorageDataByKey>
): Promise<void> {
  const storage = ensureStorageAvailable()
  const storageUpdates: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(updates)) {
    const storageKey = STORAGE_KEYS[key as StorageKey]
    storageUpdates[storageKey] = value
  }

  await storage.set(storageUpdates)
}

export async function readAllStorage(): Promise<StorageDataByKey> {
  const data = await getStorageData(ALL_STORAGE_KEYS)
  return data as StorageDataByKey
}
