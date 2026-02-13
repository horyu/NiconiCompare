import type { CompareEvent, NcEventsBucket } from "../lib/types"

export interface VideoVerdictStats {
  wins: number
  draws: number
  losses: number
}

export type VideoVerdictStatKey = keyof VideoVerdictStats

export function buildRecentEvents(
  events: NcEventsBucket,
  limit: number,
  categoryId: string,
  defaultCategoryId: string
): NcEventsBucket["items"] {
  return [...events.items]
    .filter((event) => !event.disabled)
    .filter((event) => (event.categoryId ?? defaultCategoryId) === categoryId)
    .sort((a, b) => b.id - a.id)
    .slice(0, Math.max(1, limit))
}

export function labelVerdict(verdict: string): string {
  switch (verdict) {
    case "better":
      return ">"
    case "same":
      return "="
    case "worse":
      return "<"
    default:
      return verdict
  }
}

export function verdictToStatKey(
  verdict: CompareEvent["verdict"]
): VideoVerdictStatKey {
  switch (verdict) {
    case "better":
      return "wins"
    case "same":
      return "draws"
    case "worse":
      return "losses"
    default:
      return "draws"
  }
}

export function buildVideoVerdictStats(
  events: NcEventsBucket,
  categoryId: string,
  defaultCategoryId: string
): Record<string, VideoVerdictStats> {
  const stats: Record<string, VideoVerdictStats> = {}
  const activeEvents = events.items.filter(
    (event) =>
      !event.disabled && (event.categoryId ?? defaultCategoryId) === categoryId
  )
  activeEvents.forEach((event) => {
    applyVerdictStats(stats, event.currentVideoId, event.verdict)
    applyVerdictStats(
      stats,
      event.opponentVideoId,
      invertVerdict(event.verdict)
    )
  })
  return stats
}

export function buildRecentEventVideoVerdictStats(
  events: NcEventsBucket,
  recentEvents: NcEventsBucket["items"],
  categoryId: string,
  defaultCategoryId: string
): Record<number, Record<string, VideoVerdictStats>> {
  const latestStats = buildVideoVerdictStats(
    events,
    categoryId,
    defaultCategoryId
  )
  const perEventStats: Record<number, Record<string, VideoVerdictStats>> = {}

  recentEvents.forEach((event) => {
    perEventStats[event.id] = {
      [event.currentVideoId]: cloneVerdictStats(
        latestStats[event.currentVideoId]
      ),
      [event.opponentVideoId]: cloneVerdictStats(
        latestStats[event.opponentVideoId]
      )
    }

    applyVerdictDelta(latestStats, event.currentVideoId, event.verdict, -1)
    applyVerdictDelta(
      latestStats,
      event.opponentVideoId,
      invertVerdict(event.verdict),
      -1
    )
  })

  return perEventStats
}

function applyVerdictStats(
  stats: Record<string, VideoVerdictStats>,
  videoId: string,
  verdict: CompareEvent["verdict"]
): void {
  const current = stats[videoId] ?? { wins: 0, draws: 0, losses: 0 }
  switch (verdict) {
    case "better":
      current.wins += 1
      break
    case "same":
      current.draws += 1
      break
    case "worse":
      current.losses += 1
      break
    default:
      break
  }
  stats[videoId] = current
}

function applyVerdictDelta(
  stats: Record<string, VideoVerdictStats>,
  videoId: string,
  verdict: CompareEvent["verdict"],
  delta: 1 | -1
): void {
  const current = stats[videoId] ?? { wins: 0, draws: 0, losses: 0 }
  switch (verdict) {
    case "better":
      current.wins = Math.max(0, current.wins + delta)
      break
    case "same":
      current.draws = Math.max(0, current.draws + delta)
      break
    case "worse":
      current.losses = Math.max(0, current.losses + delta)
      break
    default:
      break
  }
  stats[videoId] = current
}

function cloneVerdictStats(
  stats: VideoVerdictStats | undefined
): VideoVerdictStats {
  return {
    wins: stats?.wins ?? 0,
    draws: stats?.draws ?? 0,
    losses: stats?.losses ?? 0
  }
}

function invertVerdict(
  verdict: CompareEvent["verdict"]
): CompareEvent["verdict"] {
  switch (verdict) {
    case "better":
      return "worse"
    case "worse":
      return "better"
    case "same":
      return "same"
    default:
      return "same"
  }
}
