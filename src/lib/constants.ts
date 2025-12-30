import type {
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcSettings,
  NcState
} from "./types"

export const STORAGE_KEYS = {
  settings: "nc_settings",
  state: "nc_state",
  videos: "nc_videos",
  authors: "nc_authors",
  events: "nc_events",
  ratings: "nc_ratings",
  meta: "nc_meta",
  categories: "nc_categories"
} as const

export const DEFAULT_CATEGORY_ID = "00000000-0000-0000-0000-000000000000"
export const DEFAULT_CATEGORY_NAME = "総合"

export const DEFAULT_CATEGORIES: NcCategories = {
  items: {
    [DEFAULT_CATEGORY_ID]: {
      id: DEFAULT_CATEGORY_ID,
      name: DEFAULT_CATEGORY_NAME,
      createdAt: 0
    }
  },
  order: [DEFAULT_CATEGORY_ID],
  overlayVisibleIds: [DEFAULT_CATEGORY_ID],
  defaultId: DEFAULT_CATEGORY_ID
}

export const DEFAULT_SETTINGS: NcSettings = {
  recentWindowSize: 5,
  popupRecentCount: 5,
  overlayAndCaptureEnabled: true,
  overlayAutoCloseMs: 2000,
  showEventThumbnails: true,
  activeCategoryId: DEFAULT_CATEGORY_ID,
  glicko: {
    rating: 1500,
    rd: 350,
    volatility: 0.06
  }
}

export const MAX_RECENT_WINDOW_SIZE = 50
export const MAX_POPUP_RECENT_COUNT = 20

export const DEFAULT_STATE: NcState = {
  currentVideoId: "",
  pinnedOpponentVideoId: "",
  recentWindow: []
}

export const DEFAULT_EVENTS_BUCKET: NcEventsBucket = {
  items: [],
  nextId: 1
}

export const DEFAULT_META: NcMeta = {
  lastReplayEventId: 0,
  schemaVersion: "1.0.0",
  lastCleanupAt: 0
}

export const MESSAGE_TYPES = {
  registerSnapshot: "nc/registerSnapshot",
  updateCurrentVideo: "nc/updateCurrentVideo",
  updatePinnedOpponent: "nc/updatePinnedOpponent",
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
  importData: "nc/importData",
  createCategory: "nc/createCategory",
  updateCategoryName: "nc/updateCategoryName",
  deleteCategory: "nc/deleteCategory",
  reorderCategories: "nc/reorderCategories",
  updateOverlayVisibleIds: "nc/updateOverlayVisibleIds",
  updateActiveCategory: "nc/updateActiveCategory",
  bulkMoveEvents: "nc/bulkMoveEvents"
} as const
