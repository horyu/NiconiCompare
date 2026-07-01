import { formatPaddedDateTime } from "../../lib/date"
import type { CompareEvent } from "../../lib/types"
import { createWatchUrl } from "../../lib/url"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

export interface EventExportRow {
  id: string
  occurredAt: string
  status: string
  currentVideoId: string
  currentVideoUrl: string
  currentVideoTitle: string
  currentVideoAuthor: string
  opponentVideoId: string
  opponentVideoUrl: string
  opponentVideoTitle: string
  opponentVideoAuthor: string
  verdict: string
}

interface FilterEventsParams {
  events: readonly CompareEvent[]
  includeDeleted: boolean
  verdict: string
  categoryId: string
  defaultCategoryId: string
  search: string
  videos: OptionsSnapshot["videos"]
  authors: OptionsSnapshot["authors"]
}

interface EventExportRowsParams {
  events: readonly CompareEvent[]
  snapshot: OptionsSnapshot
}

export function filterEvents({
  events,
  includeDeleted,
  verdict,
  categoryId,
  defaultCategoryId,
  search,
  videos,
  authors
}: FilterEventsParams): CompareEvent[] {
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = events.filter((event) => {
    if (!includeDeleted && event.disabled) {
      return false
    }
    if (verdict !== "all" && event.verdict !== verdict) {
      return false
    }
    const resolvedCategoryId = event.categoryId ?? defaultCategoryId
    if (resolvedCategoryId !== categoryId) {
      return false
    }
    if (normalizedSearch.length === 0) {
      return true
    }
    const idMatch = String(event.id).includes(normalizedSearch)
    const current = videos[event.currentVideoId]
    const opponent = videos[event.opponentVideoId]
    const currentAuthor = current ? authors[current.authorUrl]?.name : undefined
    const opponentAuthor = opponent
      ? authors[opponent.authorUrl]?.name
      : undefined
    const text =
      `${event.currentVideoId} ${event.opponentVideoId} ` +
      `${current?.title ?? ""} ${opponent?.title ?? ""} ` +
      `${currentAuthor ?? ""} ${opponentAuthor ?? ""}`
    return idMatch || text.toLowerCase().includes(normalizedSearch)
  })
  return filtered.sort((a, b) => b.id - a.id)
}

export function buildEventExportRows({
  events,
  snapshot
}: EventExportRowsParams): EventExportRow[] {
  return events.map((event) => {
    const currentVideo = snapshot.videos[event.currentVideoId]
    const opponentVideo = snapshot.videos[event.opponentVideoId]
    const currentAuthor = currentVideo
      ? snapshot.authors[currentVideo.authorUrl]?.name
      : ""
    const opponentAuthor = opponentVideo
      ? snapshot.authors[opponentVideo.authorUrl]?.name
      : ""
    return {
      id: String(event.id),
      occurredAt: formatPaddedDateTime(new Date(event.timestamp)),
      status: event.disabled ? "無効" : "有効",
      currentVideoId: event.currentVideoId,
      currentVideoUrl: createWatchUrl(event.currentVideoId),
      currentVideoTitle: currentVideo?.title ?? "",
      currentVideoAuthor: currentAuthor ?? "",
      opponentVideoId: event.opponentVideoId,
      opponentVideoUrl: createWatchUrl(event.opponentVideoId),
      opponentVideoTitle: opponentVideo?.title ?? "",
      opponentVideoAuthor: opponentAuthor ?? "",
      verdict: formatVerdict(event.verdict)
    }
  })
}

function formatVerdict(verdict: CompareEvent["verdict"]): string {
  if (verdict === "better") {
    return "勝ち"
  }
  if (verdict === "same") {
    return "引き分け"
  }
  return "負け"
}
