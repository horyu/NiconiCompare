import {
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  MESSAGE_TYPES
} from "../lib/constants"
import type {
  AuthorProfile,
  NcSettings,
  StorageShape,
  Verdict,
  VideoSnapshot
} from "../lib/types"
import {
  handleDeleteAllData,
  handleExportData,
  handleImportData
} from "./handlers/data"
import { handleRecordEvent } from "./handlers/event"
import {
  handleDeleteEvent,
  handlePurgeEvent,
  handleRestoreEvent
} from "./handlers/event-lifecycle"
import { handleMetaAction } from "./handlers/meta"
import { handleRebuildRatings } from "./handlers/ratings"
import { handleToggleOverlay, handleUpdateSettings } from "./handlers/settings"
import { handleRegisterSnapshot } from "./handlers/snapshot"
import { readStateSnapshot } from "./handlers/state"
import {
  handleUpdateCurrentVideo,
  handleUpdatePinnedOpponent
} from "./handlers/video"
import { runAutoCleanupIfNeeded } from "./services/cleanup"
import { processRetryQueue } from "./services/retry"
import { getRawStorageData, setStorageData } from "./services/storage"

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
