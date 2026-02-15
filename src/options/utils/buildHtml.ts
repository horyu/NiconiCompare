import type { CompareEvent, RatingSnapshot } from "../../lib/types"
import { createWatchUrl } from "../../lib/url"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import shareReportTemplate from "../templates/share-report.template.html?raw"
import { pad2 } from "./date"

interface BuildShareHtmlInput {
  snapshot: OptionsSnapshot
  categoryId: string
}

interface ShareVideoRow {
  videoId: string
  title: string
  videoUrl: string
  thumbnailUrl: string
  authorName: string
  rating: number | null
  rd: number | null
  wins: number
  draws: number
  losses: number
  evalCount: number
  lastVerdictAt: number | null
}

interface ShareEventRow {
  id: number
  timestamp: number
  currentVideoId: string
  currentTitle: string
  currentAuthorName: string
  currentVideoUrl: string
  opponentVideoId: string
  opponentTitle: string
  opponentAuthorName: string
  opponentVideoUrl: string
  verdict: "better" | "same" | "worse"
  verdictLabel: string
}

interface SharePayload {
  meta: {
    generatedAt: number
    categoryName: string
    videoCount: number
    eventCount: number
    glicko: {
      rating: number
      rd: number
      volatility: number
    }
  }
  videos: ShareVideoRow[]
  events: ShareEventRow[]
}

export const buildShareExportFilename = (categoryName: string): string => {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(
    now.getHours()
  )}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  return `NiconiCompareShare-${sanitizeFilenameSegment(categoryName)}-${stamp}.html`
}

export const buildShareHtml = ({
  snapshot,
  categoryId
}: BuildShareHtmlInput): string => {
  const categoryName = snapshot.categories.items[categoryId]?.name ?? categoryId
  const payload = buildSharePayload({ snapshot, categoryId, categoryName })
  const embeddedPayload = JSON.stringify(payload).replaceAll("<", "\\u003c")
  return applyTemplate(shareReportTemplate, {
    PAGE_TITLE: escapeHtml(categoryName),
    EMBEDDED_PAYLOAD: embeddedPayload
  })
}

const buildSharePayload = ({
  snapshot,
  categoryId,
  categoryName
}: {
  snapshot: OptionsSnapshot
  categoryId: string
  categoryName: string
}): SharePayload => {
  const events = snapshot.events.items
    .filter((event) => {
      if (event.disabled) return false
      return (
        resolveCategoryId(event, snapshot.categories.defaultId) === categoryId
      )
    })
    .sort((left, right) => right.id - left.id)
  const videoIds = new Set<string>()
  const statsByVideo = new Map<
    string,
    {
      wins: number
      draws: number
      losses: number
      lastVerdictAt: number | null
    }
  >()
  for (const event of events) {
    videoIds.add(event.currentVideoId)
    videoIds.add(event.opponentVideoId)
    const currentStats = ensureVideoStats(statsByVideo, event.currentVideoId)
    const opponentStats = ensureVideoStats(statsByVideo, event.opponentVideoId)
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
    currentStats.lastVerdictAt = Math.max(
      currentStats.lastVerdictAt ?? 0,
      event.timestamp
    )
    opponentStats.lastVerdictAt = Math.max(
      opponentStats.lastVerdictAt ?? 0,
      event.timestamp
    )
  }
  const ratingsByCategory = snapshot.ratings[categoryId] ?? {}
  const videos = [...videoIds]
    .map((videoId) =>
      buildVideoRow({
        videoId,
        snapshot,
        rating: ratingsByCategory[videoId],
        stats: statsByVideo.get(videoId)
      })
    )
    .sort((left, right) => {
      const ratingDelta = (right.rating ?? -1) - (left.rating ?? -1)
      if (ratingDelta !== 0) return ratingDelta
      return left.title.localeCompare(right.title, "ja")
    })
  const shareEvents = events.map((event) => buildEventRow({ event, snapshot }))
  return {
    meta: {
      generatedAt: Date.now(),
      categoryName,
      videoCount: videos.length,
      eventCount: shareEvents.length,
      glicko: {
        rating: snapshot.settings.glicko.rating,
        rd: snapshot.settings.glicko.rd,
        volatility: snapshot.settings.glicko.volatility
      }
    },
    videos,
    events: shareEvents
  }
}

const buildVideoRow = ({
  videoId,
  snapshot,
  rating,
  stats
}: {
  videoId: string
  snapshot: OptionsSnapshot
  rating?: RatingSnapshot
  stats?: {
    wins: number
    draws: number
    losses: number
    lastVerdictAt: number | null
  }
}): ShareVideoRow => {
  const { title, thumbnailUrl, authorName } = getVideoDisplayFields(
    snapshot,
    videoId
  )
  const wins = stats?.wins ?? 0
  const draws = stats?.draws ?? 0
  const losses = stats?.losses ?? 0
  return {
    videoId,
    title,
    videoUrl: createWatchUrl(videoId),
    thumbnailUrl,
    authorName,
    rating: rating?.rating ?? null,
    rd: rating?.rd ?? null,
    wins,
    draws,
    losses,
    evalCount: wins + draws + losses,
    lastVerdictAt: stats?.lastVerdictAt ?? null
  }
}

const getVideoDisplayFields = (
  snapshot: OptionsSnapshot,
  videoId: string
): { title: string; thumbnailUrl: string; authorName: string } => {
  const video = snapshot.videos[videoId]
  if (!video) {
    return { title: "データ未取得", thumbnailUrl: "", authorName: "不明" }
  }
  return {
    title: video.title || "データ未取得",
    thumbnailUrl: video.thumbnailUrls?.[0] ?? "",
    authorName: snapshot.authors[video.authorUrl]?.name ?? "不明"
  }
}

const buildEventRow = ({
  event,
  snapshot
}: {
  event: CompareEvent
  snapshot: OptionsSnapshot
}): ShareEventRow => {
  const currentVideo = snapshot.videos[event.currentVideoId]
  const opponentVideo = snapshot.videos[event.opponentVideoId]
  const currentAuthorName = currentVideo
    ? snapshot.authors[currentVideo.authorUrl]?.name
    : undefined
  const opponentAuthorName = opponentVideo
    ? snapshot.authors[opponentVideo.authorUrl]?.name
    : undefined
  return {
    id: event.id,
    timestamp: event.timestamp,
    currentVideoId: event.currentVideoId,
    currentTitle: currentVideo?.title ?? "データ未取得",
    currentAuthorName: currentAuthorName ?? "不明",
    currentVideoUrl: createWatchUrl(event.currentVideoId),
    opponentVideoId: event.opponentVideoId,
    opponentTitle: opponentVideo?.title ?? "データ未取得",
    opponentAuthorName: opponentAuthorName ?? "不明",
    opponentVideoUrl: createWatchUrl(event.opponentVideoId),
    verdict: event.verdict,
    verdictLabel:
      event.verdict === "better"
        ? "勝ち"
        : event.verdict === "same"
          ? "引き分け"
          : "負け"
  }
}

const ensureVideoStats = (
  map: Map<
    string,
    {
      wins: number
      draws: number
      losses: number
      lastVerdictAt: number | null
    }
  >,
  videoId: string
): {
  wins: number
  draws: number
  losses: number
  lastVerdictAt: number | null
} => {
  const existing = map.get(videoId)
  if (existing) return existing
  const created = { wins: 0, draws: 0, losses: 0, lastVerdictAt: null }
  map.set(videoId, created)
  return created
}

const resolveCategoryId = (
  event: CompareEvent,
  defaultCategoryId: string
): string => event.categoryId || defaultCategoryId

const sanitizeFilenameSegment = (value: string): string =>
  value.replaceAll(/[\\/:*?"<>|]/g, "")

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const applyTemplate = (
  template: string,
  values: Record<string, string>
): string => {
  let output = template
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{{${key}}}`, value)
  }
  return output
}
