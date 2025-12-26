import { MESSAGE_TYPES } from "./constants"
import type {
  AuthorProfile,
  NcSettings,
  StorageShape,
  Verdict,
  VideoSnapshot
} from "./types"

export type RegisterSnapshotMessage = {
  type: typeof MESSAGE_TYPES.registerSnapshot
  payload: { video: VideoSnapshot; author: AuthorProfile }
}

export type UpdateCurrentVideoMessage = {
  type: typeof MESSAGE_TYPES.updateCurrentVideo
  payload: { videoId: string }
}

export type UpdatePinnedOpponentMessage = {
  type: typeof MESSAGE_TYPES.updatePinnedOpponent
  payload: { videoId?: string }
}

export type RecordEventMessage = {
  type: typeof MESSAGE_TYPES.recordEvent
  payload: {
    currentVideoId: string
    opponentVideoId: string
    verdict: Verdict
    eventId?: number
  }
}

export type DeleteEventMessage = {
  type: typeof MESSAGE_TYPES.deleteEvent
  payload: {
    eventId: number
  }
}

export type RestoreEventMessage = {
  type: typeof MESSAGE_TYPES.restoreEvent
  payload: {
    eventId: number
  }
}

export type PurgeEventMessage = {
  type: typeof MESSAGE_TYPES.purgeEvent
  payload: {
    eventId: number
  }
}

export type DeleteAllDataMessage = {
  type: typeof MESSAGE_TYPES.deleteAllData
}

export type ToggleOverlayMessage = {
  type: typeof MESSAGE_TYPES.toggleOverlay
  payload: { enabled: boolean }
}

export type UpdateSettingsMessage = {
  type: typeof MESSAGE_TYPES.updateSettings
  payload: Partial<NcSettings>
}

export type MetaActionMessage = {
  type: typeof MESSAGE_TYPES.metaAction
  payload: { action: "cleanup" }
}

export type RebuildRatingsMessage = {
  type: typeof MESSAGE_TYPES.rebuildRatings
}

export type ExportDataMessage = {
  type: typeof MESSAGE_TYPES.exportData
}

export type ImportDataMessage = {
  type: typeof MESSAGE_TYPES.importData
  payload: {
    data: Partial<StorageShape>
  }
}

export type RequestStateMessage = {
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
  return chrome.runtime.sendMessage(message) as Promise<TResponse>
}
