import { produce } from "immer"

import {
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  MAX_RECENT_WINDOW_SIZE,
  MESSAGE_TYPES,
  STORAGE_KEYS
} from "../lib/constants"
import { updatePairRatings } from "../lib/glicko"
import type {
  AuthorProfile,
  CompareEvent,
  NcAuthors,
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos,
  RatingSnapshot,
  StorageShape,
  Verdict,
  VideoSnapshot
} from "../lib/types"
import {
  getRawStorageData,
  getStorageData,
  readAllStorage,
  setStorageData
} from "./services/storage"

const RETRY_DELAYS = [1000, 3000, 5000]
const AUTO_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

processRetryQueue().catch((error) =>
  console.error("Retry queue processing failed", error)
)

if (chrome?.alarms) {
  chrome.alarms.create("nc.processRetry", { periodInMinutes: 1 })
  chrome.alarms.create("nc.autoCleanup", { periodInMinutes: 60 * 24 })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "nc.processRetry") {
      processRetryQueue().catch((error) =>
        console.error("Retry queue processing failed", error)
      )
    }
    if (alarm.name === "nc.autoCleanup") {
      runAutoCleanupIfNeeded().catch((error) =>
        console.error("Failed to run auto cleanup", error)
      )
    }
  })
}
type RegisterSnapshotMessage = {
  type: typeof MESSAGE_TYPES.registerSnapshot
  payload: { video: VideoSnapshot; author: AuthorProfile }
}

type UpdateCurrentVideoMessage = {
  type: typeof MESSAGE_TYPES.updateCurrentVideo
  payload: { videoId: string }
}

type UpdatePinnedOpponentMessage = {
  type: typeof MESSAGE_TYPES.updatePinnedOpponent
  payload: { videoId?: string }
}

type RecordEventMessage = {
  type: typeof MESSAGE_TYPES.recordEvent
  payload: {
    currentVideoId: string
    opponentVideoId: string
    verdict: Verdict
    eventId?: number
  }
}

type DeleteEventMessage = {
  type: typeof MESSAGE_TYPES.deleteEvent
  payload: {
    eventId: number
  }
}

type RestoreEventMessage = {
  type: typeof MESSAGE_TYPES.restoreEvent
  payload: {
    eventId: number
  }
}

type PurgeEventMessage = {
  type: typeof MESSAGE_TYPES.purgeEvent
  payload: {
    eventId: number
  }
}

type DeleteAllDataMessage = {
  type: typeof MESSAGE_TYPES.deleteAllData
}

type ToggleOverlayMessage = {
  type: typeof MESSAGE_TYPES.toggleOverlay
  payload: { enabled: boolean }
}

type UpdateSettingsMessage = {
  type: typeof MESSAGE_TYPES.updateSettings
  payload: Partial<NcSettings>
}

type MetaActionMessage = {
  type: typeof MESSAGE_TYPES.metaAction
  payload:
    | { action: "clearRetry"; clearFailed?: boolean }
    | { action: "cleanup" }
}

type RebuildRatingsMessage = {
  type: typeof MESSAGE_TYPES.rebuildRatings
}

type ExportDataMessage = {
  type: typeof MESSAGE_TYPES.exportData
}

type ImportDataMessage = {
  type: typeof MESSAGE_TYPES.importData
  payload: {
    data: Partial<StorageShape>
  }
}

type RequestStateMessage = {
  type: typeof MESSAGE_TYPES.requestState
}

type Message =
  | RegisterSnapshotMessage
  | UpdateCurrentVideoMessage
  | UpdatePinnedOpponentMessage
  | RecordEventMessage
  | DeleteEventMessage
  | RestoreEventMessage
  | PurgeEventMessage
  | DeleteAllDataMessage
  | ToggleOverlayMessage
  | UpdateSettingsMessage
  | MetaActionMessage
  | RebuildRatingsMessage
  | ExportDataMessage
  | ImportDataMessage
  | RequestStateMessage

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((error) =>
    console.error("Failed to init defaults", error)
  )
  runAutoCleanupIfNeeded().catch((error) =>
    console.error("Failed to run auto cleanup", error)
  )
})

ensureDefaults().catch((error) =>
  console.error("Failed to init defaults", error)
)
runAutoCleanupIfNeeded().catch((error) =>
  console.error("Failed to run auto cleanup", error)
)

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    ;(async () => {
      try {
        switch (message.type) {
          case MESSAGE_TYPES.registerSnapshot:
            await handleRegisterSnapshot(message.payload)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.updateCurrentVideo:
            await handleUpdateCurrentVideo(message.payload.videoId)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.updatePinnedOpponent:
            await handleUpdatePinnedOpponent(message.payload.videoId)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.recordEvent: {
            const eventId = await handleRecordEvent(message.payload)
            sendResponse({ ok: true, eventId })
            break
          }
          case MESSAGE_TYPES.deleteEvent: {
            const deleted = await handleDeleteEvent(message.payload.eventId)
            sendResponse({ ok: true, deleted })
            break
          }
          case MESSAGE_TYPES.restoreEvent: {
            const restored = await handleRestoreEvent(message.payload.eventId)
            sendResponse({ ok: true, restored })
            break
          }
          case MESSAGE_TYPES.purgeEvent: {
            const purged = await handlePurgeEvent(message.payload.eventId)
            sendResponse({ ok: true, purged })
            break
          }
          case MESSAGE_TYPES.deleteAllData:
            await handleDeleteAllData()
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.toggleOverlay:
            await handleToggleOverlay(message.payload.enabled)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.updateSettings:
            await handleUpdateSettings(message.payload)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.metaAction:
            await handleMetaAction(message.payload)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.rebuildRatings:
            await handleRebuildRatings()
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.exportData: {
            const data = await handleExportData()
            sendResponse({ ok: true, data })
            break
          }
          case MESSAGE_TYPES.importData:
            await handleImportData(message.payload.data)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.requestState: {
            const state = await readStateSnapshot()
            sendResponse({ ok: true, data: state })
            break
          }
          default:
            sendResponse({ ok: false, error: "Unknown message" })
        }
      } catch (error) {
        console.error("background message error", error)
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unexpected error"
        })
      }
    })()
    return true
  }
)

async function ensureDefaults() {
  const result = await getRawStorageData([
    "settings",
    "state",
    "events",
    "meta",
    "videos",
    "authors",
    "ratings"
  ])
  const updates: Parameters<typeof setStorageData>[0] = {}

  if (!result.settings) {
    updates.settings = DEFAULT_SETTINGS
  }
  if (!result.state) {
    updates.state = DEFAULT_STATE
  }
  if (!result.events) {
    updates.events = DEFAULT_EVENTS_BUCKET
  }
  if (!result.meta) {
    updates.meta = DEFAULT_META
  }
  if (!result.videos) {
    updates.videos = {}
  }
  if (!result.authors) {
    updates.authors = {}
  }
  if (!result.ratings) {
    updates.ratings = {}
  }

  if (Object.keys(updates).length > 0) {
    await setStorageData(updates)
  }
}

async function runAutoCleanupIfNeeded() {
  const { meta } = await getStorageData(["meta"])
  const lastCleanupAt = Number(meta.lastCleanupAt ?? 0)
  if (Date.now() - lastCleanupAt >= AUTO_CLEANUP_INTERVAL_MS) {
    await performCleanup()
  }
}

async function handleDeleteAllData() {
  await setStorageData({
    settings: DEFAULT_SETTINGS,
    state: DEFAULT_STATE,
    events: DEFAULT_EVENTS_BUCKET,
    meta: DEFAULT_META,
    videos: {},
    authors: {},
    ratings: {}
  })
}

async function handleRegisterSnapshot(payload: {
  video: VideoSnapshot
  author: AuthorProfile
}) {
  const { videos, authors } = await getStorageData(["videos", "authors"])

  await setStorageData({
    videos: {
      ...videos,
      [payload.video.videoId]: payload.video
    },
    authors: {
      ...authors,
      [payload.author.authorUrl]: payload.author
    }
  })
}

async function handleUpdateCurrentVideo(videoId: string) {
  const { state, settings, videos } = await getStorageData([
    "state",
    "settings",
    "videos"
  ])

  if (state.currentVideoId === videoId) {
    return
  }

  const nextState = produce(state, (draft) => {
    if (state.currentVideoId && state.currentVideoId !== videoId) {
      draft.recentWindow = insertVideoIntoRecentWindow(
        draft.recentWindow,
        settings.recentWindowSize,
        state.currentVideoId,
        videos
      )
    }
    draft.currentVideoId = videoId
  })

  await setStorageData({ state: nextState })
}

async function handleUpdatePinnedOpponent(videoId?: string) {
  const { state, videos } = await getStorageData(["state", "videos"])
  const nextPinned = videoId && videos[videoId] ? videoId : undefined

  await setStorageData({
    state: {
      ...state,
      pinnedOpponentVideoId: nextPinned
    }
  })
}

async function handleRecordEvent(payload: RecordEventMessage["payload"]) {
  const { events, state, settings, ratings, videos } = await getStorageData([
    "events",
    "state",
    "settings",
    "ratings",
    "videos"
  ])

  const targetEvent = payload.eventId
    ? events.items.find(
        (event) => event.id === payload.eventId && !event.disabled
      )
    : undefined
  const isTargetSamePair =
    targetEvent &&
    ((targetEvent.currentVideoId === payload.currentVideoId &&
      targetEvent.opponentVideoId === payload.opponentVideoId) ||
      (targetEvent.currentVideoId === payload.opponentVideoId &&
        targetEvent.opponentVideoId === payload.currentVideoId))

  if (targetEvent && isTargetSamePair) {
    const updatedEvents = produce(events, (draft) => {
      const index = draft.items.findIndex(
        (event) => event.id === targetEvent.id
      )
      if (index !== -1) {
        draft.items[index] = {
          ...draft.items[index],
          verdict: payload.verdict,
          timestamp: Date.now()
        }
      }
    })

    const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

    try {
      await setStorageData({
        events: updatedEvents,
        ratings: nextRatings
      })
      await markEventPersistent(targetEvent.id)
      await removeRetryEntry(targetEvent.id)
      return targetEvent.id
    } catch (error) {
      console.error("Failed to persist event", error)
      await queueEventRetry(targetEvent.id)
      throw error
    }
  }

  const eventId = events.nextId

  const newEvent: CompareEvent = {
    id: eventId,
    timestamp: Date.now(),
    currentVideoId: payload.currentVideoId,
    opponentVideoId: payload.opponentVideoId,
    verdict: payload.verdict,
    disabled: false,
    persistent: false
  }

  const updatedEvents: NcEventsBucket = {
    items: [...events.items, newEvent],
    nextId: eventId + 1
  }

  const leftRating = getOrCreateRatingSnapshot(
    ratings,
    payload.currentVideoId,
    settings
  )
  const rightRating = getOrCreateRatingSnapshot(
    ratings,
    payload.opponentVideoId,
    settings
  )

  const nextRatings = produce(ratings, (draft) => {
    const { left, right } = updatePairRatings({
      settings,
      left: leftRating,
      right: rightRating,
      verdict: payload.verdict,
      eventId
    })
    draft[left.videoId] = left
    draft[right.videoId] = right
  })

  const updatedState = produce(state, (draft) => {
    draft.recentWindow = buildRecentWindow(
      draft.recentWindow,
      settings.recentWindowSize,
      payload.currentVideoId,
      payload.opponentVideoId,
      videos
    )
  })

  try {
    await setStorageData({
      events: updatedEvents,
      state: updatedState,
      ratings: nextRatings
    })
    await markEventPersistent(eventId)
    await removeRetryEntry(eventId)
    return eventId
  } catch (error) {
    console.error("Failed to persist event", error)
    await queueEventRetry(eventId)
    throw error
  }
}

async function handleDeleteEvent(eventId: number) {
  const { events, settings, meta } = await getStorageData([
    "events",
    "settings",
    "meta"
  ])

  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return false
  }

  if (events.items[index].disabled) {
    return true
  }

  const updatedEvents = produce(events, (draft) => {
    draft.items[index] = { ...draft.items[index], disabled: true }
  })
  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  await setStorageData({
    events: updatedEvents,
    ratings: nextRatings,
    meta
  })

  return true
}

async function handleRestoreEvent(eventId: number) {
  const { events, settings } = await getStorageData(["events", "settings"])

  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return false
  }

  if (!events.items[index].disabled) {
    return true
  }

  const updatedEvents = produce(events, (draft) => {
    draft.items[index] = { ...draft.items[index], disabled: false }
  })
  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  await setStorageData({
    events: updatedEvents,
    ratings: nextRatings
  })

  return true
}

async function handlePurgeEvent(eventId: number) {
  const { events, settings, meta } = await getStorageData([
    "events",
    "settings",
    "meta"
  ])

  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return false
  }

  if (!events.items[index].disabled) {
    return false
  }

  const updatedEvents: NcEventsBucket = {
    items: events.items.filter((event) => event.id !== eventId),
    nextId: events.nextId
  }
  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  await setStorageData({
    events: updatedEvents,
    ratings: nextRatings,
    meta
  })

  return true
}

async function handleToggleOverlay(enabled: boolean) {
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

async function readStateSnapshot() {
  try {
    const data = await readAllStorage()
    const settings = normalizeSettings(data.settings)
    const state = data.state
    const videos = data.videos
    const events = data.events
    const ratings = data.ratings
    const meta = data.meta
    const authors = data.authors

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
      authors
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
      authors: {}
    }
  }
}

async function handleUpdateSettings(partial: Partial<NcSettings>) {
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

async function handleMetaAction(payload: MetaActionMessage["payload"]) {
  const { meta } = await getStorageData(["meta"])

  if (payload.action === "cleanup") {
    await performCleanup()
    return
  }

  if (payload.action === "clearRetry") {
    await setStorageData({
      meta: {
        ...meta,
        retryQueue: [],
        failedWrites: payload.clearFailed ? [] : meta.failedWrites
      }
    })
  }
}

async function handleRebuildRatings() {
  const { settings, events } = await getStorageData(["events", "settings"])
  const nextRatings = rebuildRatingsFromEvents(events.items, settings)

  await setStorageData({ ratings: nextRatings })
}

async function handleExportData() {
  try {
    const data = await readAllStorage()
    return {
      [STORAGE_KEYS.settings]: data.settings,
      [STORAGE_KEYS.state]: data.state,
      [STORAGE_KEYS.videos]: data.videos,
      [STORAGE_KEYS.authors]: data.authors,
      [STORAGE_KEYS.events]: data.events,
      [STORAGE_KEYS.ratings]: data.ratings,
      [STORAGE_KEYS.meta]: data.meta
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
      [STORAGE_KEYS.meta]: DEFAULT_META
    }
  }
}

async function handleImportData(data: Partial<StorageShape>) {
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

  const eventItems = Array.isArray(nextEvents.items) ? nextEvents.items : []
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
  const nextRatings = rebuildRatingsFromEvents(
    normalizedEvents.items,
    nextSettings
  )

  await setStorageData({
    settings: nextSettings,
    state: rebuiltState,
    events: normalizedEvents,
    meta: normalizedMeta,
    videos: nextVideos,
    authors: nextAuthors,
    ratings: nextRatings
  })
}

function getOrCreateRatingSnapshot(
  ratings: NcRatings,
  videoId: string,
  settings: NcSettings
): RatingSnapshot {
  const existing = ratings[videoId]
  if (existing) {
    return existing
  }
  return {
    videoId,
    rating: settings.glicko.rating,
    rd: settings.glicko.rd,
    volatility: settings.glicko.volatility,
    updatedFromEventId: 0
  }
}

function rebuildRatingsFromEvents(
  events: CompareEvent[],
  settings: NcSettings
): NcRatings {
  const nextRatings: NcRatings = {}
  const orderedEvents = events
    .filter((event) => !event.disabled)
    .sort((a, b) => a.id - b.id)

  for (const event of orderedEvents) {
    const leftRating = getOrCreateRatingSnapshot(
      nextRatings,
      event.currentVideoId,
      settings
    )
    const rightRating = getOrCreateRatingSnapshot(
      nextRatings,
      event.opponentVideoId,
      settings
    )
    const { left, right } = updatePairRatings({
      settings,
      left: leftRating,
      right: rightRating,
      verdict: event.verdict,
      eventId: event.id
    })
    nextRatings[left.videoId] = left
    nextRatings[right.videoId] = right
  }

  return nextRatings
}

function buildRecentWindow(
  current: string[],
  size: number,
  currentVideoId: string,
  opponentVideoId: string,
  videos: NcVideos
) {
  const hasVideo = (id: string) => !!(id && videos[id])
  const deduped = current.filter(
    (id) => id !== currentVideoId && id !== opponentVideoId && hasVideo(id)
  )
  const next = [currentVideoId, opponentVideoId, ...deduped].filter(hasVideo)
  return next.slice(0, Math.max(1, size))
}

function insertVideoIntoRecentWindow(
  current: string[],
  size: number,
  videoId: string,
  videos: NcVideos
) {
  const filtered = current.filter((id) => videos[id])
  if (!videoId || !videos[videoId]) {
    return filtered
  }
  const deduped = filtered.filter((id) => id !== videoId)
  return [videoId, ...deduped].slice(0, Math.max(1, size))
}

async function markEventPersistent(eventId: number) {
  const { events } = await getStorageData(["events"])
  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return true
  }
  if (events.items[index].persistent) {
    return true
  }

  const updatedEvents = produce(events, (draft) => {
    draft.items[index] = { ...draft.items[index], persistent: true }
  })
  await setStorageData({ events: updatedEvents })
  return true
}

async function queueEventRetry(eventId: number) {
  const { meta } = await getStorageData(["meta"])
  if (meta.retryQueue.some((entry) => entry.eventId === eventId)) {
    return
  }

  const updatedMeta = produce(meta, (draft) => {
    draft.retryQueue.push({
      eventId,
      retryCount: 0,
      lastAttempt: Date.now()
    })
  })
  await setStorageData({ meta: updatedMeta })
}

async function removeRetryEntry(eventId: number) {
  const { meta } = await getStorageData(["meta"])
  const nextQueue = meta.retryQueue.filter((entry) => entry.eventId !== eventId)
  const nextFailed = meta.failedWrites.filter((id) => id !== eventId)
  if (
    nextQueue.length === meta.retryQueue.length &&
    nextFailed.length === meta.failedWrites.length
  ) {
    return
  }
  await setStorageData({
    meta: {
      ...meta,
      retryQueue: nextQueue,
      failedWrites: nextFailed
    }
  })
}

async function processRetryQueue() {
  const { meta } = await getStorageData(["meta"])
  const queue = [...meta.retryQueue]
  const remaining = []
  const failedWrites = new Set(meta.failedWrites)
  const now = Date.now()

  for (const entry of queue) {
    const delay =
      RETRY_DELAYS[Math.min(entry.retryCount, RETRY_DELAYS.length - 1)]
    if (now - entry.lastAttempt < delay) {
      remaining.push(entry)
      continue
    }
    try {
      const success = await markEventPersistent(entry.eventId)
      if (!success) {
        throw new Error("markEventPersistent returned false")
      }
      await removeRetryEntry(entry.eventId)
    } catch (error) {
      console.error("Retry failed", error)
      if (entry.retryCount + 1 >= RETRY_DELAYS.length) {
        failedWrites.add(entry.eventId)
      } else {
        remaining.push({
          ...entry,
          retryCount: entry.retryCount + 1,
          lastAttempt: now
        })
      }
    }
  }

  const updatedMeta = produce(meta, (draft) => {
    draft.retryQueue = remaining
    draft.failedWrites = Array.from(failedWrites)
  })
  await setStorageData({ meta: updatedMeta })
}

async function performCleanup() {
  const { events, videos, authors, ratings, meta, state } =
    await getStorageData([
      "events",
      "videos",
      "authors",
      "ratings",
      "meta",
      "state"
    ])

  const referencedVideos = new Set<string>()
  const referencedAuthors = new Set<string>()

  events.items
    .filter((event) => !event.disabled)
    .forEach((event) => {
      if (event.currentVideoId) {
        referencedVideos.add(event.currentVideoId)
      }
      if (event.opponentVideoId) {
        referencedVideos.add(event.opponentVideoId)
      }
    })
  if (state.currentVideoId) {
    referencedVideos.add(state.currentVideoId)
  }
  if (state.pinnedOpponentVideoId) {
    referencedVideos.add(state.pinnedOpponentVideoId)
  }
  state.recentWindow.forEach((videoId) => {
    if (videoId) {
      referencedVideos.add(videoId)
    }
  })

  Object.values(videos).forEach((video) => {
    if (video.authorUrl) {
      referencedAuthors.add(video.authorUrl)
    }
  })

  const cleanedVideos = Object.fromEntries(
    Object.entries(videos).filter(([videoId]) => referencedVideos.has(videoId))
  )
  const cleanedRatings = Object.fromEntries(
    Object.entries(ratings).filter(([videoId]) => referencedVideos.has(videoId))
  )
  const cleanedAuthors = Object.fromEntries(
    Object.entries(authors).filter(([authorUrl]) =>
      referencedAuthors.has(authorUrl)
    )
  )

  await setStorageData({
    videos: cleanedVideos,
    ratings: cleanedRatings,
    authors: cleanedAuthors,
    meta: {
      ...meta,
      lastCleanupAt: Date.now()
    }
  })
}

function rebuildRecentWindowFromEvents(
  events: CompareEvent[],
  size: number,
  videos: NcVideos
) {
  if (size <= 0) {
    return []
  }
  const next: string[] = []
  let inspected = 0
  for (
    let i = events.length - 1;
    i >= 0 && inspected < 100 && next.length < size;
    i--
  ) {
    const event = events[i]
    inspected++
    if (event.disabled) {
      continue
    }
    const candidates = [event.currentVideoId, event.opponentVideoId]
    for (const candidate of candidates) {
      if (!candidate) {
        continue
      }
      if (!videos[candidate]) {
        continue
      }
      if (!next.includes(candidate)) {
        next.push(candidate)
        if (next.length >= size) {
          break
        }
      }
    }
  }
  return next.slice(0, size)
}

function normalizeSettings(settings: NcSettings): NcSettings {
  return {
    ...settings,
    recentWindowSize: Math.min(
      MAX_RECENT_WINDOW_SIZE,
      Math.max(1, Math.floor(settings.recentWindowSize || 5))
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
