import type { NcEventsBucket, NcMeta, NcSettings, NcState } from "./types"

export const STORAGE_KEYS = {
  settings: "nc_settings",
  state: "nc_state",
  videos: "nc_videos",
  authors: "nc_authors",
  events: "nc_events",
  ratings: "nc_ratings",
  meta: "nc_meta"
} as const

export const DEFAULT_SETTINGS: NcSettings = {
  recentWindowSize: 5,
  overlayAndCaptureEnabled: true,
  overlayAutoCloseMs: 2000,
  showEventThumbnails: true,
  glicko: {
    rating: 1500,
    rd: 350,
    volatility: 0.06
  }
}

export const DEFAULT_STATE: NcState = {
  currentVideoId: undefined,
  recentWindow: []
}

export const DEFAULT_EVENTS_BUCKET: NcEventsBucket = {
  items: [],
  nextId: 1
}

export const DEFAULT_META: NcMeta = {
  lastReplayEventId: 0,
  schemaVersion: "1.0.0",
  needsCleanup: false,
  retryQueue: [],
  failedWrites: []
}

export const MESSAGE_TYPES = {
  registerSnapshot: "nc/registerSnapshot",
  updateCurrentVideo: "nc/updateCurrentVideo",
  recordEvent: "nc/recordEvent",
  deleteEvent: "nc/deleteEvent",
  restoreEvent: "nc/restoreEvent",
  purgeEvent: "nc/purgeEvent",
  deleteAllData: "nc/deleteAllData",
  toggleOverlay: "nc/toggleOverlay",
  requestState: "nc/requestState",
  updateSettings: "nc/updateSettings",
  metaAction: "nc/metaAction",
  rebuildRatings: "nc/rebuildRatings",
  exportData: "nc/exportData",
  importData: "nc/importData"
} as const
