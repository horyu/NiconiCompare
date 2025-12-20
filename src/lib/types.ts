export type Verdict = "better" | "same" | "worse"

export type VideoSnapshot = {
  videoId: string
  title: string
  authorUrl: string
  thumbnailUrls: string[]
  lengthSeconds: number
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
  deleted: boolean
  persistent?: boolean
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
  overlayEnabled: boolean
  overlayAutoCloseMs: number
  glicko: {
    rating: number
    rd: number
    volatility: number
  }
}

export type NcState = {
  currentVideoId?: string
  recentWindow: string[]
}

export type NcEventsBucket = {
  items: CompareEvent[]
  nextId: number
}

export type NcRatings = Record<string, RatingSnapshot>
export type NcVideos = Record<string, VideoSnapshot>
export type NcAuthors = Record<string, AuthorProfile>

export type RetryQueueItem = {
  eventId: number
  retryCount: number
  lastAttempt: number
}

export type NcMeta = {
  lastReplayEventId: number
  schemaVersion: string
  needsCleanup: boolean
  retryQueue: RetryQueueItem[]
  failedWrites: number[]
}

export type StorageShape = {
  nc_settings: NcSettings
  nc_state: NcState
  nc_videos: NcVideos
  nc_authors: NcAuthors
  nc_events: NcEventsBucket
  nc_ratings: NcRatings
  nc_meta: NcMeta
}
