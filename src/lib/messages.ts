import type { MESSAGE_TYPES } from "./constants"
import type {
  AuthorProfile,
  NcAuthors,
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos,
  StorageShape,
  Verdict,
  VideoSnapshot
} from "./types"
import type { Assert, Equals } from "./typeUtils"

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

export interface OpenOptionsPageMessage {
  type: typeof MESSAGE_TYPES.openOptionsPage
}

export interface RequestStateMessage {
  type: typeof MESSAGE_TYPES.requestState
}

export interface StateSnapshot {
  settings: NcSettings
  state: NcState
  videos: NcVideos
  authors: NcAuthors
  events: NcEventsBucket
  ratings: NcRatings
  meta: NcMeta
  categories: NcCategories
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
  | OpenOptionsPageMessage
  | RequestStateMessage

// Message ユニオン型が MESSAGE_TYPES のすべてのキーをカバーしていることを確認
type MessageTypeValues = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]
type MessageUnionTypes = Message["type"]

type _AssertAllMessageTypes = Assert<
  Equals<MessageTypeValues, MessageUnionTypes>
>
const _assertAllMessageTypes: _AssertAllMessageTypes = true

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

type EmptySuccessResponse = { ok: true }

type MessageSuccessResponseByType = {
  [MESSAGE_TYPES.registerSnapshot]: EmptySuccessResponse
  [MESSAGE_TYPES.updateCurrentVideo]: EmptySuccessResponse
  [MESSAGE_TYPES.updatePinnedOpponent]: EmptySuccessResponse
  [MESSAGE_TYPES.recordEvent]: { ok: true; eventId: number }
  [MESSAGE_TYPES.deleteEvent]: { ok: true; deleted: boolean }
  [MESSAGE_TYPES.restoreEvent]: { ok: true; restored: boolean }
  [MESSAGE_TYPES.purgeEvent]: { ok: true; purged: boolean }
  [MESSAGE_TYPES.deleteAllData]: EmptySuccessResponse
  [MESSAGE_TYPES.toggleOverlay]: EmptySuccessResponse
  [MESSAGE_TYPES.updateSettings]: EmptySuccessResponse
  [MESSAGE_TYPES.metaAction]: EmptySuccessResponse
  [MESSAGE_TYPES.rebuildRatings]: EmptySuccessResponse
  [MESSAGE_TYPES.exportData]: { ok: true; data: StorageShape }
  [MESSAGE_TYPES.importData]: EmptySuccessResponse
  [MESSAGE_TYPES.createCategory]: { ok: true; data: { categoryId: string } }
  [MESSAGE_TYPES.updateCategoryName]: EmptySuccessResponse
  [MESSAGE_TYPES.deleteCategory]: EmptySuccessResponse
  [MESSAGE_TYPES.reorderCategories]: EmptySuccessResponse
  [MESSAGE_TYPES.updateOverlayVisibleIds]: EmptySuccessResponse
  [MESSAGE_TYPES.updateActiveCategory]: EmptySuccessResponse
  [MESSAGE_TYPES.bulkMoveEvents]: EmptySuccessResponse
  [MESSAGE_TYPES.openOptionsPage]: EmptySuccessResponse
  [MESSAGE_TYPES.requestState]: { ok: true; data: StateSnapshot }
}

type MessageSuccessResponse<TMessage extends Message> =
  MessageSuccessResponseByType[TMessage["type"]]

export type MessageResponse<TMessage extends Message> =
  | MessageSuccessResponse<TMessage>
  | { ok: false; error: string }

export async function sendNcMessage<TMessage extends Message>(
  message: TMessage
): Promise<MessageResponse<TMessage>> {
  const response = await chrome.runtime.sendMessage<
    TMessage,
    MessageResponse<TMessage>
  >(message)
  return response
}
