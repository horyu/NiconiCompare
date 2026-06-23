import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  STORAGE_KEYS
} from "../../lib/constants"
import { handleBackgroundError } from "../../lib/errorHandler"
import { logger } from "../../lib/logger"
import type {
  NcAuthors,
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos
} from "../../lib/types"
import type { Assert, Equals } from "../../lib/typeUtils"

export interface StorageDataByKey {
  settings: NcSettings
  state: NcState
  videos: NcVideos
  authors: NcAuthors
  events: NcEventsBucket
  ratings: NcRatings
  meta: NcMeta
  categories: NcCategories
}

export type StorageKey = keyof StorageDataByKey

const DEFAULT_BY_KEY: StorageDataByKey = {
  settings: DEFAULT_SETTINGS,
  state: DEFAULT_STATE,
  videos: {},
  authors: {},
  events: DEFAULT_EVENTS_BUCKET,
  ratings: {},
  meta: DEFAULT_META,
  categories: DEFAULT_CATEGORIES
}

const ALL_STORAGE_KEYS = [
  "settings",
  "state",
  "videos",
  "authors",
  "events",
  "ratings",
  "meta",
  "categories"
] as const satisfies readonly StorageKey[]

// 型レベルで ALL_STORAGE_KEYS がすべての StorageKey を含むことを保証
type KeysFromObject = keyof StorageDataByKey
type KeysFromArray = (typeof ALL_STORAGE_KEYS)[number]

type _AssertAllStorageKeys = Assert<Equals<KeysFromArray, KeysFromObject>>
const _assertAllStorageKeys: _AssertAllStorageKeys = true

let storageOperationQueue: Promise<void> = Promise.resolve()

function ensureStorageAvailable(): chrome.storage.LocalStorageArea {
  const storage = chrome?.storage?.local
  if (!storage) {
    throw new Error("chrome.storage.local is unavailable")
  }
  return storage
}

async function enqueueStorageOperation<TResult>(
  operation: () => Promise<TResult>
): Promise<TResult> {
  const result = storageOperationQueue.then(operation)
  storageOperationQueue = result.then(
    () => undefined,
    () => undefined
  )
  const value = await result
  return value
}

async function getStorageDataInternal<K extends StorageKey>(
  keys: readonly K[]
): Promise<Pick<StorageDataByKey, K>> {
  const storage = ensureStorageAvailable()
  const storageKeys = keys.map((key) => STORAGE_KEYS[key])
  const result = await storage.get(storageKeys)

  // oxlint-disable-next-line no-unsafe-type-assertion
  const data = {} as Pick<StorageDataByKey, K>
  for (const key of keys) {
    const storageKey = STORAGE_KEYS[key]
    const value = result[storageKey]
    // oxlint-disable-next-line no-unsafe-type-assertion
    data[key] = (value ?? DEFAULT_BY_KEY[key]) as StorageDataByKey[K]
  }

  return data
}

async function getRawStorageDataInternal<K extends StorageKey>(
  keys: readonly K[]
): Promise<Partial<Pick<StorageDataByKey, K>>> {
  const storage = ensureStorageAvailable()
  const storageKeys = keys.map((key) => STORAGE_KEYS[key])
  const result = await storage.get(storageKeys)

  const data = {} as Partial<Pick<StorageDataByKey, K>>
  for (const key of keys) {
    const storageKey = STORAGE_KEYS[key]
    const value = result[storageKey]
    if (value !== undefined) {
      // oxlint-disable-next-line no-unsafe-type-assertion
      data[key] = value as StorageDataByKey[K]
    }
  }

  return data
}

async function setStorageDataInternal(
  updates: Partial<StorageDataByKey>
): Promise<void> {
  const storage = ensureStorageAvailable()
  const storageUpdates: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(updates)) {
    // oxlint-disable-next-line no-unsafe-type-assertion
    const storageKey = STORAGE_KEYS[key as StorageKey]
    storageUpdates[storageKey] = value
  }

  await storage.set(storageUpdates)
}

export async function getStorageData<K extends StorageKey>(
  keys: readonly K[]
): Promise<Pick<StorageDataByKey, K>> {
  const data = await enqueueStorageOperation(() => getStorageDataInternal(keys))
  return data
}

export async function setStorageData(
  updates: Partial<StorageDataByKey>
): Promise<void> {
  await enqueueStorageOperation(() => setStorageDataInternal(updates))
}

export async function readAllStorage(): Promise<StorageDataByKey> {
  const data = await getStorageData(ALL_STORAGE_KEYS)
  return data as StorageDataByKey
}

// The update callback runs while the storage queue is held. It must only use
// the provided data and return updates instead of calling public storage APIs.
export async function withStorageUpdates<K extends StorageKey, TResult>({
  keys,
  context,
  update
}: {
  keys: K[]
  context: string
  update: (
    data: Pick<StorageDataByKey, K>
  ) =>
    | { updates: Partial<StorageDataByKey>; result?: TResult }
    | Promise<{ updates: Partial<StorageDataByKey>; result?: TResult }>
}): Promise<TResult | undefined> {
  const result = await enqueueStorageOperation(async () => {
    try {
      const data = await getStorageDataInternal(keys)
      const { updates, result: operationResult } = await update(data)
      if (Object.keys(updates).length > 0) {
        logger.info(`[${context}] storage update`, Object.keys(updates).sort())
        await setStorageDataInternal(updates)
      }
      return operationResult
    } catch (error) {
      handleBackgroundError(error, context)
      throw error
    }
  })
  return result
}

// Raw transactions are reserved for initialization that must distinguish
// missing keys from keys containing default values.
export async function withRawStorageUpdates<K extends StorageKey, TResult>({
  keys,
  context,
  update
}: {
  keys: readonly K[]
  context: string
  update: (
    data: Partial<Pick<StorageDataByKey, K>>
  ) =>
    | { updates: Partial<StorageDataByKey>; result?: TResult }
    | Promise<{ updates: Partial<StorageDataByKey>; result?: TResult }>
}): Promise<TResult | undefined> {
  const result = await enqueueStorageOperation(async () => {
    try {
      const data = await getRawStorageDataInternal(keys)
      const { updates, result: operationResult } = await update(data)
      if (Object.keys(updates).length > 0) {
        logger.info(`[${context}] storage update`, Object.keys(updates).sort())
        await setStorageDataInternal(updates)
      }
      return operationResult
    } catch (error) {
      handleBackgroundError(error, context)
      throw error
    }
  })
  return result
}
