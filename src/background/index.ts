import { produce } from "immer"

import {
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
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

type RegisterSnapshotMessage = {
  type: typeof MESSAGE_TYPES.registerSnapshot
  payload: { video: VideoSnapshot; author: AuthorProfile }
}

type UpdateCurrentVideoMessage = {
  type: typeof MESSAGE_TYPES.updateCurrentVideo
  payload: { videoId: string }
}

type RecordEventMessage = {
  type: typeof MESSAGE_TYPES.recordEvent
  payload: {
    leftVideoId: string
    rightVideoId: string
    verdict: Verdict
  }
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
    | { action: "ackCleanup" }
    | { action: "clearRetry"; clearFailed?: boolean }
}

type RequestStateMessage = {
  type: typeof MESSAGE_TYPES.requestState
}

type Message =
  | RegisterSnapshotMessage
  | UpdateCurrentVideoMessage
  | RecordEventMessage
  | ToggleOverlayMessage
  | UpdateSettingsMessage
  | MetaActionMessage
  | RequestStateMessage

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((error) =>
    console.error("Failed to init defaults", error)
  )
})

ensureDefaults().catch((error) =>
  console.error("Failed to init defaults", error)
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
          case MESSAGE_TYPES.recordEvent: {
            const eventId = await handleRecordEvent(message.payload)
            sendResponse({ ok: true, eventId })
            break
          }
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
  const data = await chrome.storage.local.get(STORAGE_KEYS.state)
  const state = (data[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE

  if (state.currentVideoId === videoId) {
    return
  }

  const nextState: NcState = {
    ...state,
    currentVideoId: videoId
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.state]: nextState
  })
}

async function handleRecordEvent(payload: RecordEventMessage["payload"]) {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.events,
    STORAGE_KEYS.state,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.ratings
  ])

  const events =
    (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET
  const state = (result[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE
  const settings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const ratings = (result[STORAGE_KEYS.ratings] as NcRatings) ?? {}

  const eventId = events.nextId

  const newEvent: CompareEvent = {
    id: eventId,
    timestamp: Date.now(),
    leftVideoId: payload.leftVideoId,
    rightVideoId: payload.rightVideoId,
    verdict: payload.verdict,
    deleted: false,
    persistent: true
  }

  const updatedEvents: NcEventsBucket = {
    items: [...events.items, newEvent],
    nextId: eventId + 1
  }

  const leftRating = getOrCreateRatingSnapshot(
    ratings,
    payload.leftVideoId,
    settings
  )
  const rightRating = getOrCreateRatingSnapshot(
    ratings,
    payload.rightVideoId,
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
      payload.leftVideoId,
      payload.rightVideoId
    )
  })

  await chrome.storage.local.set({
    [STORAGE_KEYS.events]: updatedEvents,
    [STORAGE_KEYS.state]: updatedState,
    [STORAGE_KEYS.ratings]: nextRatings
  })

  return eventId
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

  if (settings.overlayEnabled === enabled) {
    return
  }

  await storage.set({
    [STORAGE_KEYS.settings]: {
      ...settings,
      overlayEnabled: enabled
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
      meta: DEFAULT_META
    }
  }
  const result = await storage.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.state,
    STORAGE_KEYS.events,
    STORAGE_KEYS.ratings,
    STORAGE_KEYS.meta
  ])
  return {
    settings: (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS,
    state: (result[STORAGE_KEYS.state] as NcState) ?? DEFAULT_STATE,
    events:
      (result[STORAGE_KEYS.events] as NcEventsBucket) ?? DEFAULT_EVENTS_BUCKET,
    ratings: (result[STORAGE_KEYS.ratings] as NcRatings) ?? {},
    meta: (result[STORAGE_KEYS.meta] as NcMeta) ?? DEFAULT_META
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
    STORAGE_KEYS.state
  ])

  const currentSettings =
    (result[STORAGE_KEYS.settings] as NcSettings) ?? DEFAULT_SETTINGS
  const nextSettings = normalizeSettings({ ...currentSettings, ...partial })

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
        nextSettings.recentWindowSize
      )
    }
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

  if (payload.action === "ackCleanup") {
    await storage.set({
      [STORAGE_KEYS.meta]: {
        ...meta,
        needsCleanup: false
      }
    })
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

function buildRecentWindow(
  current: string[],
  size: number,
  leftVideoId: string,
  rightVideoId: string
) {
  const deduped = current.filter(
    (id) => id !== leftVideoId && id !== rightVideoId && !!id
  )
  const next = [leftVideoId, rightVideoId, ...deduped].filter(Boolean)
  return next.slice(0, Math.max(1, size))
}

function rebuildRecentWindowFromEvents(events: CompareEvent[], size: number) {
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
    if (event.deleted) {
      continue
    }
    const candidates = [event.leftVideoId, event.rightVideoId]
    for (const candidate of candidates) {
      if (!candidate) {
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
      10,
      Math.max(1, Math.floor(settings.recentWindowSize || 5))
    ),
    overlayAutoCloseMs: Math.min(
      5000,
      Math.max(500, settings.overlayAutoCloseMs || 1500)
    ),
    glicko: settings.glicko || DEFAULT_SETTINGS.glicko
  }
}
