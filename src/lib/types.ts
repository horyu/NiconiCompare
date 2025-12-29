export type Verdict = "better" | "same" | "worse"

export type VideoSnapshot = {
  videoId: string
  title: string
  authorUrl: string
  thumbnailUrls: string[]
  capturedAt: number
}

export type AuthorProfile = {
  authorUrl: string
  name: string
  capturedAt: number
}

export type CompareEvent = {
  id: number
  timestamp: number
  currentVideoId: string
  opponentVideoId: string
  verdict: Verdict
  disabled: boolean
  categoryId: string
}

export type RatingSnapshot = {
  videoId: string
  rating: number
  rd: number
  volatility: number
  updatedFromEventId: number
}

export type NcSettings = {
  recentWindowSize: number
  popupRecentCount: number
  overlayAndCaptureEnabled: boolean
  overlayAutoCloseMs: number
  showEventThumbnails: boolean
  activeCategoryId: string
  glicko: {
    rating: number
    rd: number
    volatility: number
  }
}

export type NcState = {
  currentVideoId?: string
  pinnedOpponentVideoId?: string
  recentWindow: string[]
}

export type NcEventsBucket = {
  items: CompareEvent[]
  nextId: number
}

export type NcRatings = Record<string, Record<string, RatingSnapshot>>

export type Category = {
  id: string
  name: string
  createdAt: number
}

export type NcCategories = {
  items: Record<string, Category>
  order: string[]
  overlayVisibleIds: string[]
  defaultId: string
}
export type NcVideos = Record<string, VideoSnapshot>
export type NcAuthors = Record<string, AuthorProfile>

export type NcMeta = {
  lastReplayEventId: number
  schemaVersion: string
  lastCleanupAt: number
}

export type StorageShape = {
  nc_settings: NcSettings
  nc_state: NcState
  nc_videos: NcVideos
  nc_authors: NcAuthors
  nc_events: NcEventsBucket
  nc_ratings: NcRatings
  nc_meta: NcMeta
  nc_categories: NcCategories
}
