import type { RatingSnapshot, VideoSnapshot } from "../../lib/types"
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
