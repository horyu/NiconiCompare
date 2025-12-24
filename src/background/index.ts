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
  const result = await chrome.storage.local.get(Object.values(STORAGE_KEYS))
  const updates: Partial<StorageShape> = {}

  if (!result[STORAGE_KEYS.settings]) {
    updates[STORAGE_KEYS.settings] = DEFAULT_SETTINGS
  }
  if (!result[STORAGE_KEYS.state]) {
    updates[STORAGE_KEYS.state] = DEFAULT_STATE
  }
  if (!result[STORAGE_KEYS.events]) {
    updates[STORAGE_KEYS.events] = DEFAULT_EVENTS_BUCKET
  }
  if (!result[STORAGE_KEYS.meta]) {
    updates[STORAGE_KEYS.meta] = DEFAULT_META
  }
  if (!result[STORAGE_KEYS.videos]) {
    updates[STORAGE_KEYS.videos] = {}
  }
  if (!result[STORAGE_KEYS.authors]) {
    updates[STORAGE_KEYS.authors] = {}
  }
  if (!result[STORAGE_KEYS.ratings]) {
    updates[STORAGE_KEYS.ratings] = {}
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates)
  }
}

async function runAutoCleanupIfNeeded() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.meta)
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  const lastCleanupAt = Number(meta.lastCleanupAt ?? 0)
  if (Date.now() - lastCleanupAt >= AUTO_CLEANUP_INTERVAL_MS) {
    await performCleanup()
  }
}

async function handleDeleteAllData() {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }
  await storage.set({
    [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
    [STORAGE_KEYS.state]: DEFAULT_STATE,
    [STORAGE_KEYS.events]: DEFAULT_EVENTS_BUCKET,
    [STORAGE_KEYS.meta]: DEFAULT_META,
    [STORAGE_KEYS.videos]: {},
    [STORAGE_KEYS.authors]: {},
    [STORAGE_KEYS.ratings]: {}
  })
}

async function handleRegisterSnapshot(payload: {
  video: VideoSnapshot
  author: AuthorProfile
}) {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.videos,
    STORAGE_KEYS.authors
  ])
  const videos = (data[STORAGE_KEYS.videos] as NcVideos) ?? {}
  const authors = (data[STORAGE_KEYS.authors] as NcAuthors) ?? {}

  const updates: Partial<StorageShape> = {}
  updates[STORAGE_KEYS.videos] = {
    ...videos,
    [payload.video.videoId]: payload.video
  }
  updates[STORAGE_KEYS.authors] = {
    ...authors,
    [payload.author.authorUrl]: payload.author
  }

  await chrome.storage.local.set(updates)
}

async function handleUpdateCurrentVideo(videoId: string) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }
  const data = await storage.get([
    STORAGE_KEYS.state,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.videos
  ])
  const state = (data[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE
  const settings =
    (data[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const videos = (data[STORAGE_KEYS.videos] as NcVideos) ?? {}

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

  await storage.set({
    [STORAGE_KEYS.state]: nextState
  })
}

async function handleUpdatePinnedOpponent(videoId?: string) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }

  const data = await storage.get([STORAGE_KEYS.state, STORAGE_KEYS.videos])
  const state = (data[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE
  const videos = (data[STORAGE_KEYS.videos] as NcVideos) ?? {}
  const nextPinned = videoId && videos[videoId] ? videoId : undefined

  await storage.set({
    [STORAGE_KEYS.state]: {
      ...state,
      pinnedOpponentVideoId: nextPinned
    }
  })
}

async function handleRecordEvent(payload: RecordEventMessage["payload"]) {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.events,
    STORAGE_KEYS.state,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.ratings,
    STORAGE_KEYS.videos
  ])

  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const state = (result[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE
  const settings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const ratings = (result[STORAGE_KEYS.ratings] as NcRatings) ?? {}
  const videos = (result[STORAGE_KEYS.videos] as NcVideos) ?? {}

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
      await chrome.storage.local.set({
        [STORAGE_KEYS.events]: updatedEvents,
        [STORAGE_KEYS.ratings]: nextRatings
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
    await chrome.storage.local.set({
      [STORAGE_KEYS.events]: updatedEvents,
      [STORAGE_KEYS.state]: updatedState,
      [STORAGE_KEYS.ratings]: nextRatings
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
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return false
  }

  const result = await storage.get([
    STORAGE_KEYS.events,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.ratings,
    STORAGE_KEYS.meta
  ])
  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const settings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META

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

  await storage.set({
    [STORAGE_KEYS.events]: updatedEvents,
    [STORAGE_KEYS.ratings]: nextRatings,
    [STORAGE_KEYS.meta]: meta
  })

  return true
}

async function handleRestoreEvent(eventId: number) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return false
  }

  const result = await storage.get([
    STORAGE_KEYS.events,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.ratings
  ])
  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const settings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS

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

  await storage.set({
    [STORAGE_KEYS.events]: updatedEvents,
    [STORAGE_KEYS.ratings]: nextRatings
  })

  return true
}

async function handlePurgeEvent(eventId: number) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return false
  }

  const result = await storage.get([
    STORAGE_KEYS.events,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.meta
  ])
  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const settings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META

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

  await storage.set({
    [STORAGE_KEYS.events]: updatedEvents,
    [STORAGE_KEYS.ratings]: nextRatings,
    [STORAGE_KEYS.meta]: meta
  })

  return true
}

async function handleToggleOverlay(enabled: boolean) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }
  const data = await storage.get(STORAGE_KEYS.settings)
  const settings =
    (data[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS

  if (settings.overlayAndCaptureEnabled === enabled) {
    return
  }

  await storage.set({
    [STORAGE_KEYS.settings]: {
      ...settings,
      overlayAndCaptureEnabled: enabled
    }
  })
}

async function readStateSnapshot() {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
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
  const result = await storage.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.state,
    STORAGE_KEYS.events,
    STORAGE_KEYS.ratings,
    STORAGE_KEYS.meta,
    STORAGE_KEYS.videos,
    STORAGE_KEYS.authors
  ])
  const settings = normalizeSettings(
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  )
  const state = (result[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE
  const videos = (result[STORAGE_KEYS.videos] as NcVideos) ?? {}
  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const ratings = (result[STORAGE_KEYS.ratings] as NcRatings) ?? {}
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  const authors = (result[STORAGE_KEYS.authors] as NcAuthors) ?? {}

  let normalizedState = state
  if (state.pinnedOpponentVideoId && !videos[state.pinnedOpponentVideoId]) {
    normalizedState = {
      ...state,
      pinnedOpponentVideoId: undefined
    }
    await storage.set({
      [STORAGE_KEYS.state]: normalizedState
    })
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
}

async function handleUpdateSettings(partial: Partial<NcSettings>) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }

  const result = await storage.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.events,
    STORAGE_KEYS.state,
    STORAGE_KEYS.videos
  ])

  const currentSettings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const nextSettings = normalizeSettings({ ...currentSettings, ...partial })
  const videos = (result[STORAGE_KEYS.videos] as NcVideos) ?? {}

  const updates: Partial<StorageShape> = {
    [STORAGE_KEYS.settings]: nextSettings
  }

  if (nextSettings.recentWindowSize !== currentSettings.recentWindowSize) {
    const events =
      (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
    const state = (result[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE
    updates[STORAGE_KEYS.state] = {
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
    const events =
      (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
    updates[STORAGE_KEYS.ratings] = rebuildRatingsFromEvents(
      events.items,
      nextSettings
    )
  }

  await storage.set(updates)
}

async function handleMetaAction(payload: MetaActionMessage["payload"]) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }
  const result = await storage.get(STORAGE_KEYS.meta)
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META

  if (payload.action === "cleanup") {
    await performCleanup()
    return
  }

  if (payload.action === "clearRetry") {
    await storage.set({
      [STORAGE_KEYS.meta]: {
        ...meta,
        retryQueue: [],
        failedWrites: payload.clearFailed ? [] : meta.failedWrites
      }
    })
  }
}

async function handleRebuildRatings() {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }

  const result = await storage.get([STORAGE_KEYS.events, STORAGE_KEYS.settings])
  const settings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const nextRatings = rebuildRatingsFromEvents(events.items, settings)

  await storage.set({
    [STORAGE_KEYS.ratings]: nextRatings
  })
}

async function handleExportData() {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
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

  const result = await storage.get(Object.values(STORAGE_KEYS))
  return {
    [STORAGE_KEYS.settings]:
      (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS,
    [STORAGE_KEYS.state]:
      (result[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE,
    [STORAGE_KEYS.videos]: (result[STORAGE_KEYS.videos] as NcVideos) ?? {},
    [STORAGE_KEYS.authors]: (result[STORAGE_KEYS.authors] as NcAuthors) ?? {},
    [STORAGE_KEYS.events]:
      (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET,
    [STORAGE_KEYS.ratings]: (result[STORAGE_KEYS.ratings] as NcRatings) ?? {},
    [STORAGE_KEYS.meta]: (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  }
}

async function handleImportData(data: Partial<StorageShape>) {
  const storage = chrome?.storage?.local
  if (!storage) {
    console.warn("chrome.storage.local is unavailable.")
    return
  }

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

  await storage.set({
    [STORAGE_KEYS.settings]: nextSettings,
    [STORAGE_KEYS.state]: rebuiltState,
    [STORAGE_KEYS.events]: normalizedEvents,
    [STORAGE_KEYS.meta]: normalizedMeta,
    [STORAGE_KEYS.videos]: nextVideos,
    [STORAGE_KEYS.authors]: nextAuthors,
    [STORAGE_KEYS.ratings]: nextRatings
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
  const storage = chrome?.storage?.local
  if (!storage) {
    return false
  }
  const result = await storage.get(STORAGE_KEYS.events)
  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return true
  }
  if (events.items[index].persistent) {
    return true
  }
  events.items[index] = {
    ...events.items[index],
    persistent: true
  }
  await storage.set({
    [STORAGE_KEYS.events]: events
  })
  return true
}

async function queueEventRetry(eventId: number) {
  const storage = chrome?.storage?.local
  if (!storage) {
    return
  }
  const result = await storage.get(STORAGE_KEYS.meta)
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  if (meta.retryQueue.some((entry) => entry.eventId === eventId)) {
    return
  }
  meta.retryQueue.push({
    eventId,
    retryCount: 0,
    lastAttempt: Date.now()
  })
  await storage.set({
    [STORAGE_KEYS.meta]: meta
  })
}

async function removeRetryEntry(eventId: number) {
  const storage = chrome?.storage?.local
  if (!storage) {
    return
  }
  const result = await storage.get(STORAGE_KEYS.meta)
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  const nextQueue = meta.retryQueue.filter((entry) => entry.eventId !== eventId)
  const nextFailed = meta.failedWrites.filter((id) => id !== eventId)
  if (
    nextQueue.length === meta.retryQueue.length &&
    nextFailed.length === meta.failedWrites.length
  ) {
    return
  }
  await storage.set({
    [STORAGE_KEYS.meta]: {
      ...meta,
      retryQueue: nextQueue,
      failedWrites: nextFailed
    }
  })
}

async function processRetryQueue() {
  const storage = chrome?.storage?.local
  if (!storage) {
    return
  }
  const result = await storage.get([STORAGE_KEYS.meta, STORAGE_KEYS.events])
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  const queue = [...meta.retryQueue]
  const remaining = []
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
        meta.failedWrites = Array.from(
          new Set([...meta.failedWrites, entry.eventId])
        )
      } else {
        remaining.push({
          ...entry,
          retryCount: entry.retryCount + 1,
          lastAttempt: now
        })
      }
    }
  }

  await storage.set({
    [STORAGE_KEYS.meta]: {
      ...meta,
      retryQueue: remaining
    }
  })
}

async function performCleanup() {
  const storage = chrome?.storage?.local
  if (!storage) {
    return
  }
  const result = await storage.get([
    STORAGE_KEYS.events,
    STORAGE_KEYS.videos,
    STORAGE_KEYS.authors,
    STORAGE_KEYS.ratings,
    STORAGE_KEYS.meta,
    STORAGE_KEYS.state
  ])
  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const videos = (result[STORAGE_KEYS.videos] as NcVideos) ?? {}
  const authors = (result[STORAGE_KEYS.authors] as NcAuthors) ?? {}
  const ratings = (result[STORAGE_KEYS.ratings] as NcRatings) ?? {}
  const meta = (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
  const state = (result[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE

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

  await storage.set({
    [STORAGE_KEYS.videos]: cleanedVideos,
    [STORAGE_KEYS.ratings]: cleanedRatings,
    [STORAGE_KEYS.authors]: cleanedAuthors,
    [STORAGE_KEYS.meta]: {
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
