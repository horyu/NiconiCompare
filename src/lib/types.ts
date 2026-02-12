export const VERDICTS = ["better", "same", "worse"] as const
export type Verdict = (typeof VERDICTS)[number]

export interface VideoSnapshot {
  videoId: string
  title: string
  authorUrl: string
  thumbnailUrls: string[]
  capturedAt: number
}

export interface AuthorProfile {
  authorUrl: string
  name: string
  capturedAt: number
}

export interface CompareEvent {
  id: number
  timestamp: number
  currentVideoId: string
  opponentVideoId: string
  verdict: Verdict
  disabled: boolean
  categoryId: string
}

export interface RatingSnapshot {
  videoId: string
  rating: number
  rd: number
  volatility: number
  updatedFromEventId: number
}

export interface NcSettings {
  recentWindowSize: number
  popupRecentCount: number
  overlayAndCaptureEnabled: boolean
  overlayAutoCloseMs: number
  showClosedOverlayVerdict: boolean
  showEventThumbnails: boolean
  activeCategoryId: string
  glicko: {
    rating: number
    rd: number
    volatility: number
  }
}

export interface NcState {
  currentVideoId: string
  pinnedOpponentVideoId: string
  recentWindow: string[]
}

export interface NcEventsBucket {
  items: CompareEvent[]
  nextId: number
}

export type NcRatings = Record<string, Record<string, RatingSnapshot>>

export interface Category {
  id: string
  name: string
  createdAt: number
}

export interface NcCategories {
  items: Record<string, Category>
  order: string[]
  overlayVisibleIds: string[]
  defaultId: string
}
export type NcVideos = Record<string, VideoSnapshot>
export type NcAuthors = Record<string, AuthorProfile>

export interface NcMeta {
  lastReplayEventId: number
  schemaVersion: string
  lastCleanupAt: number
}

export interface StorageShape {
  nc_settings: NcSettings
  nc_state: NcState
  nc_videos: NcVideos
  nc_authors: NcAuthors
  nc_events: NcEventsBucket
  nc_ratings: NcRatings
  nc_meta: NcMeta
  nc_categories: NcCategories
}
