import { MESSAGE_TYPES } from "./constants"
import type {
  AuthorProfile,
  NcSettings,
  StorageShape,
  Verdict,
  VideoSnapshot
} from "./types"

export interface RegisterSnapshotMessage {
  type: typeof MESSAGE_TYPES.registerSnapshot
  payload: { video: VideoSnapshot; author: AuthorProfile }
}

export interface UpdateCurrentVideoMessage {
  type: typeof MESSAGE_TYPES.updateCurrentVideo
  payload: { videoId: string }
}

export interface UpdatePinnedOpponentMessage {
  type: typeof MESSAGE_TYPES.updatePinnedOpponent
  payload: { videoId?: string }
}

export interface RecordEventMessage {
  type: typeof MESSAGE_TYPES.recordEvent
  payload: {
    currentVideoId: string
    opponentVideoId: string
    verdict: Verdict
    eventId?: number
  }
}

export interface DeleteEventMessage {
  type: typeof MESSAGE_TYPES.deleteEvent
  payload: {
    eventId: number
  }
}

export interface RestoreEventMessage {
  type: typeof MESSAGE_TYPES.restoreEvent
  payload: {
    eventId: number
  }
}

export interface PurgeEventMessage {
  type: typeof MESSAGE_TYPES.purgeEvent
  payload: {
    eventId: number
  }
}

export interface DeleteAllDataMessage {
  type: typeof MESSAGE_TYPES.deleteAllData
}

export interface ToggleOverlayMessage {
  type: typeof MESSAGE_TYPES.toggleOverlay
  payload: { enabled: boolean }
}

export interface UpdateSettingsMessage {
  type: typeof MESSAGE_TYPES.updateSettings
  payload: Partial<NcSettings>
}

export interface MetaActionMessage {
  type: typeof MESSAGE_TYPES.metaAction
  payload: { action: "cleanup" }
}

export interface RebuildRatingsMessage {
  type: typeof MESSAGE_TYPES.rebuildRatings
}

export interface ExportDataMessage {
  type: typeof MESSAGE_TYPES.exportData
}

export interface ImportDataMessage {
  type: typeof MESSAGE_TYPES.importData
  payload: {
    data: Partial<StorageShape>
  }
}

export interface CreateCategoryMessage {
  type: typeof MESSAGE_TYPES.createCategory
  payload: {
    name: string
  }
}

export interface UpdateCategoryNameMessage {
  type: typeof MESSAGE_TYPES.updateCategoryName
  payload: {
    categoryId: string
    name: string
  }
}

export interface DeleteCategoryMessage {
  type: typeof MESSAGE_TYPES.deleteCategory
  payload: {
    categoryId: string
    moveToCategoryId?: string
  }
}

export interface ReorderCategoriesMessage {
  type: typeof MESSAGE_TYPES.reorderCategories
  payload: {
    order: string[]
  }
}

export interface UpdateOverlayVisibleIdsMessage {
  type: typeof MESSAGE_TYPES.updateOverlayVisibleIds
  payload: {
    overlayVisibleIds: string[]
  }
}

export interface UpdateActiveCategoryMessage {
  type: typeof MESSAGE_TYPES.updateActiveCategory
  payload: {
    categoryId: string
  }
}

export interface BulkMoveEventsMessage {
  type: typeof MESSAGE_TYPES.bulkMoveEvents
  payload: {
    eventIds: number[]
    targetCategoryId: string
  }
}

export interface RequestStateMessage {
  type: typeof MESSAGE_TYPES.requestState
}

export type Message =
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
  | CreateCategoryMessage
  | UpdateCategoryNameMessage
  | DeleteCategoryMessage
  | ReorderCategoriesMessage
  | UpdateOverlayVisibleIdsMessage
  | UpdateActiveCategoryMessage
  | BulkMoveEventsMessage
  | RequestStateMessage

export type BackgroundResponse<TData = unknown> =
  | {
      ok: true
      data?: TData
      eventId?: number
      deleted?: boolean
      restored?: boolean
      purged?: boolean
      error?: string
    }
  | { ok: false; error: string }

export async function sendNcMessage<TResponse = BackgroundResponse>(
  message: Message
) {
  return await chrome.runtime.sendMessage<Message, TResponse>(message)
}
