import { formatPaddedDateTime } from "../../lib/date"
import type {
  CompareEvent,
  RatingSnapshot,
  VideoSnapshot
} from "../../lib/types"
import { createWatchUrl } from "../../lib/url"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

export const VIDEO_SORT_KEYS = [
  "title",
  "author",
  "rating",
  "rd",
  "evalCount",
  "wins",
  "losses",
  "lastVerdict"
] as const

export type VideoSortKey = (typeof VIDEO_SORT_KEYS)[number]
export type VideoSortOrder = "asc" | "desc"

export interface VideoExportRow {
  videoId: string
  thumbnailUrl: string
  videoUrl: string
  title: string
  author: string
  rating: string
  rd: string
  total: string
  wins: string
  draws: string
  losses: string
  lastVerdictAt: string
}

interface FilterVideosParams {
  videos: OptionsSnapshot["videos"]
  authors: OptionsSnapshot["authors"]
  ratingsByCategory: Record<string, RatingSnapshot>
  lastEventByVideo: Map<string, number>
  verdictCountsByVideo: Map<
    string,
    { wins: number; draws: number; losses: number }
  >
  search: string
  author: string
  sort: string
  order: VideoSortOrder
}

interface SortVideosParams {
  videos: VideoSnapshot[]
  sort: string
  order: VideoSortOrder
  authors: OptionsSnapshot["authors"]
  ratingsByCategory: Record<string, RatingSnapshot>
  lastEventByVideo: Map<string, number>
  verdictCountsByVideo: Map<
    string,
    { wins: number; draws: number; losses: number }
  >
}

interface VideoExportRowsParams {
  videos: VideoSnapshot[]
  snapshot: OptionsSnapshot
  ratingsByCategory: Record<string, RatingSnapshot>
  lastEventByVideo: Map<string, number>
  verdictCountsByVideo: Map<
    string,
    { wins: number; draws: number; losses: number }
  >
}

export function buildLastEventByVideo(
  events: readonly CompareEvent[],
  defaultCategoryId: string,
  categoryId: string
): Map<string, number> {
  const map = new Map<string, number>()
  for (const event of events) {
    if (event.disabled) continue
    const resolvedCategoryId = event.categoryId ?? defaultCategoryId
    if (resolvedCategoryId !== categoryId) continue
    map.set(
      event.currentVideoId,
      Math.max(map.get(event.currentVideoId) ?? 0, event.timestamp)
    )
    map.set(
      event.opponentVideoId,
      Math.max(map.get(event.opponentVideoId) ?? 0, event.timestamp)
    )
  }
  return map
}

export function buildVerdictCountsByVideo(
  events: readonly CompareEvent[],
  defaultCategoryId: string,
  categoryId: string
): Map<string, { wins: number; draws: number; losses: number }> {
  const map = new Map<string, { wins: number; draws: number; losses: number }>()

  const ensure = (
    videoId: string
  ): { wins: number; draws: number; losses: number } => {
    const current = map.get(videoId)
    if (current) {
      return current
    }
    const next = { wins: 0, draws: 0, losses: 0 }
    map.set(videoId, next)
    return next
  }

  for (const event of events) {
    if (event.disabled) continue
    const resolvedCategoryId = event.categoryId ?? defaultCategoryId
    if (resolvedCategoryId !== categoryId) continue
    const currentStats = ensure(event.currentVideoId)
    const opponentStats = ensure(event.opponentVideoId)

    if (event.verdict === "better") {
      currentStats.wins += 1
      opponentStats.losses += 1
    } else if (event.verdict === "same") {
      currentStats.draws += 1
      opponentStats.draws += 1
    } else {
      currentStats.losses += 1
      opponentStats.wins += 1
    }
  }

  return map
}

export function filterVideos({
  videos,
  authors,
  ratingsByCategory,
  lastEventByVideo,
  verdictCountsByVideo,
  search,
  author,
  sort,
  order
}: FilterVideosParams): VideoSnapshot[] {
  const normalizedSearch = search.trim().toLowerCase()
  const normalizedAuthor = author === "all" ? "" : author.trim().toLowerCase()
  const filtered = Object.values(videos).filter((video) => {
    const hasRating = Boolean(ratingsByCategory[video.videoId])
    const matchesSearch =
      normalizedSearch.length === 0 ||
      video.videoId.toLowerCase().includes(normalizedSearch) ||
      video.title.toLowerCase().includes(normalizedSearch)
    const authorName = authors[video.authorUrl]?.name?.toLowerCase() ?? ""
    const matchesAuthor =
      normalizedAuthor.length === 0 || authorName.includes(normalizedAuthor)
    return hasRating && matchesSearch && matchesAuthor
  })

  return sortVideos({
    videos: filtered,
    sort,
    order,
    authors,
    ratingsByCategory,
    lastEventByVideo,
    verdictCountsByVideo
  })
}

export function sortVideos({
  videos,
  sort,
  order,
  authors,
  ratingsByCategory,
  lastEventByVideo,
  verdictCountsByVideo
}: SortVideosParams): VideoSnapshot[] {
  const sortKey = normalizeVideoSortKey(sort)
  const comparePrimaryAsc = getVideoPrimaryComparator({
    sort: sortKey,
    authors,
    ratingsByCategory,
    lastEventByVideo,
    verdictCountsByVideo
  })

  return [...videos].sort((left, right) => {
    const primary = comparePrimaryAsc(left, right)
    if (primary !== 0) {
      return order === "asc" ? primary : -primary
    }
    return compareByVideoId(left, right)
  })
}

export function buildVideoExportRows({
  videos,
  snapshot,
  ratingsByCategory,
  lastEventByVideo,
  verdictCountsByVideo
}: VideoExportRowsParams): VideoExportRow[] {
  return videos.map((video) => {
    const rating = ratingsByCategory[video.videoId]
    const author = snapshot.authors[video.authorUrl]
    const counts = verdictCountsByVideo.get(video.videoId) ?? {
      wins: 0,
      draws: 0,
      losses: 0
    }
    const total = counts.wins + counts.draws + counts.losses
    const lastVerdict = lastEventByVideo.get(video.videoId)
    return {
      videoId: video.videoId,
      thumbnailUrl: video.thumbnailUrls?.[0] ?? "",
      videoUrl: createWatchUrl(video.videoId),
      title: video.title ?? "",
      author: author?.name ?? "",
      rating: rating ? String(Math.round(rating.rating)) : "",
      rd: rating ? String(Math.round(rating.rd)) : "",
      total: total ? String(total) : "0",
      wins: String(counts.wins),
      draws: String(counts.draws),
      losses: String(counts.losses),
      lastVerdictAt: lastVerdict
        ? formatPaddedDateTime(new Date(lastVerdict))
        : ""
    }
  })
}

function normalizeVideoSortKey(sort: string): VideoSortKey {
  return isVideoSortKey(sort) ? sort : "rating"
}

function isVideoSortKey(sort: string): sort is VideoSortKey {
  return VIDEO_SORT_KEYS.some((key) => key === sort)
}

function getVideoPrimaryComparator({
  sort,
  authors,
  ratingsByCategory,
  lastEventByVideo,
  verdictCountsByVideo
}: {
  sort: VideoSortKey
  authors: OptionsSnapshot["authors"]
  ratingsByCategory: Record<string, RatingSnapshot>
  lastEventByVideo: Map<string, number>
  verdictCountsByVideo: Map<
    string,
    { wins: number; draws: number; losses: number }
  >
}): (left: VideoSnapshot, right: VideoSnapshot) => number {
  const compareByRating = (left: VideoSnapshot, right: VideoSnapshot): number =>
    compareNumber(
      ratingsByCategory[left.videoId]?.rating ?? 0,
      ratingsByCategory[right.videoId]?.rating ?? 0
    )
  const compareByTitle = (left: VideoSnapshot, right: VideoSnapshot): number =>
    compareString(left.title, right.title)
  const compareByAuthor = (left: VideoSnapshot, right: VideoSnapshot): number =>
    compareString(
      authors[left.authorUrl]?.name ?? "",
      authors[right.authorUrl]?.name ?? ""
    )
  const compareByRd = (left: VideoSnapshot, right: VideoSnapshot): number =>
    compareNumber(
      ratingsByCategory[left.videoId]?.rd ?? 0,
      ratingsByCategory[right.videoId]?.rd ?? 0
    )
  const compareByLastVerdict = (
    left: VideoSnapshot,
    right: VideoSnapshot
  ): number =>
    compareNumber(
      lastEventByVideo.get(left.videoId) ?? 0,
      lastEventByVideo.get(right.videoId) ?? 0
    )
  const compareByEvalCount = (
    left: VideoSnapshot,
    right: VideoSnapshot
  ): number =>
    compareNumber(
      getVerdictTotal(verdictCountsByVideo.get(left.videoId)),
      getVerdictTotal(verdictCountsByVideo.get(right.videoId))
    )
  const compareByWins = (left: VideoSnapshot, right: VideoSnapshot): number =>
    compareNumber(
      verdictCountsByVideo.get(left.videoId)?.wins ?? 0,
      verdictCountsByVideo.get(right.videoId)?.wins ?? 0
    )
  const compareByLosses = (left: VideoSnapshot, right: VideoSnapshot): number =>
    compareNumber(
      verdictCountsByVideo.get(left.videoId)?.losses ?? 0,
      verdictCountsByVideo.get(right.videoId)?.losses ?? 0
    )

  switch (sort) {
    case "title":
      return compareByTitle
    case "author":
      return compareByAuthor
    case "rd":
      return compareByRd
    case "lastVerdict":
      return compareByLastVerdict
    case "evalCount":
      return compareByEvalCount
    case "wins":
      return compareByWins
    case "losses":
      return compareByLosses
    case "rating":
      return compareByRating
    default:
      throw new Error("Unknown video sort key")
  }
}

function compareNumber(left: number, right: number): number {
  return left - right
}

function compareString(left: string, right: string): number {
  return left.localeCompare(right)
}

function compareByVideoId(left: VideoSnapshot, right: VideoSnapshot): number {
  return compareString(left.videoId, right.videoId)
}

function getVerdictTotal(
  counts: { wins: number; draws: number; losses: number } | undefined
): number {
  return counts ? counts.wins + counts.draws + counts.losses : 0
}
