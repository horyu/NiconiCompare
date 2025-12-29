import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  MESSAGE_TYPES
} from "../lib/constants"
import { handleBackgroundError } from "../lib/error-handler"
import type { Message } from "../lib/messages"
import type { NcCategories, NcSettings } from "../lib/types"
import {
  handleBulkMoveEvents,
  handleCreateCategory,
  handleDeleteCategory,
  handleReorderCategories,
  handleUpdateActiveCategory,
  handleUpdateCategoryName,
  handleUpdateOverlayVisibleIds
} from "./handlers/categories"
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
import { runMigrationIfNeeded } from "./services/migration"
import { getRawStorageData, setStorageData } from "./services/storage"
import { normalizeCategories } from "./utils/categories"
import { normalizeSettings } from "./utils/normalize"

if (chrome?.alarms) {
  chrome.alarms.create("nc.autoCleanup", { periodInMinutes: 60 * 24 })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "nc.autoCleanup") {
      runAutoCleanupIfNeeded().catch((error) =>
        handleBackgroundError(error, "autoCleanup.alarm")
      )
    }
  })
}

chrome.runtime.onInstalled.addListener(() => {
  initializeBackground("onInstalled")
})

chrome.runtime.onStartup?.addListener(() => {
  initializeBackground("onStartup")
})

initializeBackground("startup")

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
          case MESSAGE_TYPES.createCategory: {
            const categoryId = await handleCreateCategory(message.payload.name)
            sendResponse({ ok: true, data: { categoryId } })
            break
          }
          case MESSAGE_TYPES.updateCategoryName:
            await handleUpdateCategoryName(
              message.payload.categoryId,
              message.payload.name
            )
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.deleteCategory:
            await handleDeleteCategory(
              message.payload.categoryId,
              message.payload.moveToCategoryId
            )
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.reorderCategories:
            await handleReorderCategories(message.payload.order)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.updateOverlayVisibleIds:
            await handleUpdateOverlayVisibleIds(
              message.payload.overlayVisibleIds
            )
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.updateActiveCategory:
            await handleUpdateActiveCategory(message.payload.categoryId)
            sendResponse({ ok: true })
            break
          case MESSAGE_TYPES.bulkMoveEvents:
            await handleBulkMoveEvents(
              message.payload.eventIds,
              message.payload.targetCategoryId
            )
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
        handleBackgroundError(error, "backgroundMessage")
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
    "ratings",
    "categories"
  ])
  const updates: Parameters<typeof setStorageData>[0] = {}

  if (!result.settings) {
    updates.settings = DEFAULT_SETTINGS
  } else if (
    !(result.settings as NcSettings).activeCategoryId ||
    !(result.settings as NcSettings).glicko
  ) {
    updates.settings = normalizeSettings(result.settings as NcSettings)
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
  if (!result.categories) {
    updates.categories = DEFAULT_CATEGORIES
  } else {
    const normalizedCategories = normalizeCategories(
      result.categories as NcCategories
    )
    if (
      (result.categories as NcCategories).overlayVisibleIds?.length === 0 ||
      !(result.categories as NcCategories).items?.[
        normalizedCategories.defaultId
      ]
    ) {
      updates.categories = normalizedCategories
    }
  }

  if (Object.keys(updates).length > 0) {
    await setStorageData(updates)
  }
}

async function initializeBackground(context: string) {
  try {
    await runMigrationIfNeeded()
    await ensureDefaults()
    await runAutoCleanupIfNeeded()
  } catch (error) {
    handleBackgroundError(error, `initializeBackground.${context}`)
  }
}
