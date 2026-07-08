import { normalizeCategories } from "../../lib/categories"
import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  STORAGE_KEYS
} from "../../lib/constants"
import { logger } from "../../lib/logger"
import type {
  CompareEvent,
  NcEventsBucket,
  NcMeta,
  NcSettings,
  NcState,
  StorageShape
} from "../../lib/types"
import { VERDICTS } from "../../lib/types"
import { readAllStorage, setStorageData } from "../services/storage"
import { normalizeSettings } from "../utils/normalize"
import { rebuildRatingsFromEvents } from "../utils/ratingHelpers"
import { rebuildRecentWindowFromEvents } from "../utils/recentWindow"

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/u
const CURRENT_SCHEMA_VERSION = DEFAULT_META.schemaVersion
const INVALID_SCHEMA_MESSAGE =
  "インポートデータが不正です。アプリのエクスポート機能で出力したJSONをそのまま使用してください。"

function parseSchemaVersion(version: string): [number, number, number] {
  const matched = SEMVER_PATTERN.exec(version)
  if (!matched) {
    throw new Error(INVALID_SCHEMA_MESSAGE)
  }
  return [Number(matched[1]), Number(matched[2]), Number(matched[3])]
}

function compareSchemaVersion(left: string, right: string): number {
  const leftParts = parseSchemaVersion(left)
  const rightParts = parseSchemaVersion(right)
  for (let i = 0; i < leftParts.length; i++) {
    if (leftParts[i] > rightParts[i]) {
      return 1
    }
    if (leftParts[i] < rightParts[i]) {
      return -1
    }
  }
  return 0
}

function resolveImportSchemaVersion(meta?: Partial<NcMeta>): string {
  if (
    meta &&
    "schemaVersion" in meta &&
    meta.schemaVersion !== undefined &&
    typeof meta.schemaVersion !== "string"
  ) {
    throw new Error(INVALID_SCHEMA_MESSAGE)
  }

  const rawVersion =
    typeof meta?.schemaVersion === "string" ? meta.schemaVersion.trim() : ""

  if (!rawVersion) {
    if (meta?.schemaVersion !== undefined) {
      throw new Error(INVALID_SCHEMA_MESSAGE)
    }
    return CURRENT_SCHEMA_VERSION
  }

  const compared = compareSchemaVersion(rawVersion, CURRENT_SCHEMA_VERSION)
  if (compared > 0) {
    throw new Error(
      `インポートデータの schemaVersion (${rawVersion}) は現在の対応バージョン (${CURRENT_SCHEMA_VERSION}) より新しいため読み込めません。`
    )
  }
  if (compared < 0) {
    throw new Error(
      `インポートデータの schemaVersion (${rawVersion}) は古く、現在のバージョン (${CURRENT_SCHEMA_VERSION}) へのマイグレーションが未実装です。`
    )
  }
  return rawVersion
}

export async function handleDeleteAllData(): Promise<void> {
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

export async function handleExportData(): Promise<StorageShape> {
  const data = await readAllStorage()
  logger.debug("[bg:data:export] snapshot counts", {
    events: data.events.items.length,
    videos: Object.keys(data.videos).length,
    authors: Object.keys(data.authors).length,
    categories: Object.keys(data.categories.items).length
  })
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
}

export async function handleImportData(data: unknown): Promise<void> {
  validateImportData(data)
  const nextSettings = normalizeSettings(
    data[STORAGE_KEYS.settings] ?? DEFAULT_SETTINGS
  )
  const nextEvents = data[STORAGE_KEYS.events] ?? DEFAULT_EVENTS_BUCKET
  const rawState = data[STORAGE_KEYS.state] ?? DEFAULT_STATE
  const rawMeta = data[STORAGE_KEYS.meta] ?? DEFAULT_META
  const schemaVersion = resolveImportSchemaVersion(rawMeta)
  const nextMeta: NcMeta = {
    ...DEFAULT_META,
    ...rawMeta,
    schemaVersion,
    // oxlint-disable-next-line typescript/no-unnecessary-type-conversion
    lastCleanupAt: Number(rawMeta.lastCleanupAt ?? 0)
  }
  const nextVideos = data[STORAGE_KEYS.videos] ?? {}
  const nextAuthors = data[STORAGE_KEYS.authors] ?? {}
  const nextCategories = normalizeCategories(
    data[STORAGE_KEYS.categories] ?? DEFAULT_CATEGORIES
  )

  const eventItems = Array.isArray(nextEvents.items)
    ? nextEvents.items.map((event) => ({
        ...event,
        categoryId: nextCategories.items[event.categoryId ?? ""]
          ? event.categoryId
          : nextCategories.defaultId
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
    ...rawState,
    currentVideoId: rawState.currentVideoId ?? "",
    pinnedOpponentVideoId: rawState.pinnedOpponentVideoId ?? "",
    recentWindow: rebuildRecentWindowFromEvents(
      normalizedEvents.items,
      nextSettings.recentWindowSize,
      nextVideos,
      rawState.currentVideoId ?? ""
    )
  }
  const normalizedSettings: NcSettings = {
    ...nextSettings,
    activeCategoryId: nextSettings.activeCategoryId || nextCategories.defaultId
  }
  logger.debug("[bg:data:import] snapshot counts", {
    events: normalizedEvents.items.length,
    videos: Object.keys(nextVideos).length,
    authors: Object.keys(nextAuthors).length,
    categories: Object.keys(nextCategories.items).length
  })
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

function validateImportData(
  data: unknown
): asserts data is Partial<StorageShape> {
  const root = requireRecord(data, "root")
  validateSettings(root[STORAGE_KEYS.settings])
  validateState(root[STORAGE_KEYS.state])
  validateEvents(root[STORAGE_KEYS.events])
  validateVideos(root[STORAGE_KEYS.videos])
  validateAuthors(root[STORAGE_KEYS.authors])
  validateRatings(root[STORAGE_KEYS.ratings])
  validateCategories(root[STORAGE_KEYS.categories])
  validateMeta(root[STORAGE_KEYS.meta])
}

function validateSettings(value: unknown): void {
  if (value === undefined) {
    return
  }
  const settings = requireRecord(value, STORAGE_KEYS.settings)
  requireOptionalFiniteNumber(
    settings.recentWindowSize,
    "settings.recentWindowSize"
  )
  requireOptionalFiniteNumber(
    settings.popupRecentCount,
    "settings.popupRecentCount"
  )
  requireOptionalBoolean(
    settings.overlayAndCaptureEnabled,
    "settings.overlayAndCaptureEnabled"
  )
  requireOptionalFiniteNumber(
    settings.overlayAutoCloseMs,
    "settings.overlayAutoCloseMs"
  )
  requireOptionalBoolean(
    settings.showClosedOverlayVerdict,
    "settings.showClosedOverlayVerdict"
  )
  requireOptionalBoolean(
    settings.showPopupVideoVerdictCounts,
    "settings.showPopupVideoVerdictCounts"
  )
  requireOptionalBoolean(
    settings.showEventThumbnails,
    "settings.showEventThumbnails"
  )
  requireOptionalString(settings.activeCategoryId, "settings.activeCategoryId")

  if (settings.glicko !== undefined) {
    const glicko = requireRecord(settings.glicko, "settings.glicko")
    requireFiniteNumber(glicko.rating, "settings.glicko.rating")
    requireFiniteNumber(glicko.rd, "settings.glicko.rd")
    requireFiniteNumber(glicko.volatility, "settings.glicko.volatility")
  }
}

function validateState(value: unknown): void {
  if (value === undefined) {
    return
  }
  const state = requireRecord(value, STORAGE_KEYS.state)
  requireOptionalString(state.currentVideoId, "state.currentVideoId")
  requireOptionalString(
    state.pinnedOpponentVideoId,
    "state.pinnedOpponentVideoId"
  )
  requireOptionalStringArray(state.recentWindow, "state.recentWindow")
}

function validateEvents(value: unknown): void {
  if (value === undefined) {
    return
  }
  const events = requireRecord(value, STORAGE_KEYS.events)
  requireOptionalPositiveInteger(events.nextId, "events.nextId")
  if (!Array.isArray(events.items)) {
    throwInvalidImportData("events.items")
  }
  for (const [index, event] of events.items.entries()) {
    validateEvent(event, `events.items[${index}]`)
  }
}

function validateEvent(value: unknown, path: string): void {
  const event = requireRecord(value, path)
  requirePositiveInteger(event.id, `${path}.id`)
  requireFiniteNumber(event.timestamp, `${path}.timestamp`)
  requireString(event.currentVideoId, `${path}.currentVideoId`)
  requireString(event.opponentVideoId, `${path}.opponentVideoId`)
  if (!isVerdict(event.verdict)) {
    throwInvalidImportData(`${path}.verdict`)
  }
  requireBoolean(event.disabled, `${path}.disabled`)
  if (event.categoryId !== undefined) {
    requireString(event.categoryId, `${path}.categoryId`)
  }
}

function validateVideos(value: unknown): void {
  if (value === undefined) {
    return
  }
  const videos = requireRecord(value, STORAGE_KEYS.videos)
  for (const [videoId, video] of Object.entries(videos)) {
    validateVideo(video, `videos.${videoId}`)
  }
}

function validateVideo(value: unknown, path: string): void {
  const video = requireRecord(value, path)
  requireString(video.videoId, `${path}.videoId`)
  requireString(video.title, `${path}.title`)
  requireString(video.authorUrl, `${path}.authorUrl`)
  requireStringArray(video.thumbnailUrls, `${path}.thumbnailUrls`)
  requireFiniteNumber(video.capturedAt, `${path}.capturedAt`)
}

function validateAuthors(value: unknown): void {
  if (value === undefined) {
    return
  }
  const authors = requireRecord(value, STORAGE_KEYS.authors)
  for (const [authorUrl, author] of Object.entries(authors)) {
    validateAuthor(author, `authors.${authorUrl}`)
  }
}

function validateAuthor(value: unknown, path: string): void {
  const author = requireRecord(value, path)
  requireString(author.authorUrl, `${path}.authorUrl`)
  requireString(author.name, `${path}.name`)
  requireFiniteNumber(author.capturedAt, `${path}.capturedAt`)
}

function validateRatings(value: unknown): void {
  if (value === undefined) {
    return
  }
  const ratings = requireRecord(value, STORAGE_KEYS.ratings)
  for (const [categoryId, ratingsByVideo] of Object.entries(ratings)) {
    const categoryRatings = requireRecord(
      ratingsByVideo,
      `ratings.${categoryId}`
    )
    for (const [videoId, rating] of Object.entries(categoryRatings)) {
      validateRating(rating, `ratings.${categoryId}.${videoId}`)
    }
  }
}

function validateRating(value: unknown, path: string): void {
  const rating = requireRecord(value, path)
  requireString(rating.videoId, `${path}.videoId`)
  requireFiniteNumber(rating.rating, `${path}.rating`)
  requireFiniteNumber(rating.rd, `${path}.rd`)
  requireFiniteNumber(rating.volatility, `${path}.volatility`)
  requireNonNegativeInteger(
    rating.updatedFromEventId,
    `${path}.updatedFromEventId`
  )
}

function validateCategories(value: unknown): void {
  if (value === undefined) {
    return
  }
  const categories = requireRecord(value, STORAGE_KEYS.categories)
  const items = requireRecord(categories.items, "categories.items")
  for (const [categoryId, category] of Object.entries(items)) {
    validateCategory(category, `categories.items.${categoryId}`)
  }
  requireStringArray(categories.order, "categories.order")
  requireStringArray(
    categories.overlayVisibleIds,
    "categories.overlayVisibleIds"
  )
  requireString(categories.defaultId, "categories.defaultId")
}

function validateCategory(value: unknown, path: string): void {
  const category = requireRecord(value, path)
  requireString(category.id, `${path}.id`)
  requireString(category.name, `${path}.name`)
  requireFiniteNumber(category.createdAt, `${path}.createdAt`)
}

function validateMeta(value: unknown): void {
  if (value === undefined) {
    return
  }
  const meta = requireRecord(value, STORAGE_KEYS.meta)
  if (meta.lastReplayEventId !== undefined) {
    requireNonNegativeInteger(meta.lastReplayEventId, "meta.lastReplayEventId")
  }
  if (meta.schemaVersion !== undefined) {
    requireString(meta.schemaVersion, "meta.schemaVersion")
  }
  if (meta.lastCleanupAt !== undefined) {
    requireFiniteNumber(meta.lastCleanupAt, "meta.lastCleanupAt")
  }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throwInvalidImportData(path)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireString(value: unknown, path: string): void {
  if (typeof value !== "string") {
    throwInvalidImportData(path)
  }
}

function requireOptionalString(value: unknown, path: string): void {
  if (value !== undefined) {
    requireString(value, path)
  }
}

function requireStringArray(value: unknown, path: string): void {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throwInvalidImportData(path)
  }
}

function requireOptionalStringArray(value: unknown, path: string): void {
  if (value !== undefined) {
    requireStringArray(value, path)
  }
}

function requireBoolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") {
    throwInvalidImportData(path)
  }
}

function requireOptionalBoolean(value: unknown, path: string): void {
  if (value !== undefined) {
    requireBoolean(value, path)
  }
}

function requireFiniteNumber(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throwInvalidImportData(path)
  }
}

function requireOptionalFiniteNumber(value: unknown, path: string): void {
  if (value !== undefined) {
    requireFiniteNumber(value, path)
  }
}

function requirePositiveInteger(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throwInvalidImportData(path)
  }
}

function requireOptionalPositiveInteger(value: unknown, path: string): void {
  if (value !== undefined) {
    requirePositiveInteger(value, path)
  }
}

function requireNonNegativeInteger(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throwInvalidImportData(path)
  }
}

function isVerdict(value: unknown): value is CompareEvent["verdict"] {
  return (
    typeof value === "string" && VERDICTS.some((verdict) => verdict === value)
  )
}

function throwInvalidImportData(path: string): never {
  throw new Error(`${INVALID_SCHEMA_MESSAGE} (${path})`)
}
