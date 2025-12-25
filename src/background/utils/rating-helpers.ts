import { updatePairRatings } from "../../lib/glicko"
import type {
  CompareEvent,
  NcRatings,
  NcSettings,
  RatingSnapshot
} from "../../lib/types"

export function getOrCreateRatingSnapshot(
  ratings: NcRatings,
  videoId: string,
  settings: NcSettings
): RatingSnapshot {
  const existing = ratings[videoId]
  if (existing) {
    return existing
  }
  return {
    videoId,
    rating: settings.glicko.rating,
    rd: settings.glicko.rd,
    volatility: settings.glicko.volatility,
    updatedFromEventId: 0
  }
}

export function rebuildRatingsFromEvents(
  events: CompareEvent[],
  settings: NcSettings
): NcRatings {
  const nextRatings: NcRatings = {}
  const orderedEvents = events
    .filter((event) => !event.disabled)
    .sort((a, b) => a.id - b.id)

  for (const event of orderedEvents) {
    const leftRating = getOrCreateRatingSnapshot(
      nextRatings,
      event.currentVideoId,
      settings
    )
    const rightRating = getOrCreateRatingSnapshot(
      nextRatings,
      event.opponentVideoId,
      settings
    )
    const { left, right } = updatePairRatings({
      settings,
      left: leftRating,
      right: rightRating,
      verdict: event.verdict,
      eventId: event.id
    })
    nextRatings[left.videoId] = left
    nextRatings[right.videoId] = right
  }

  return nextRatings
}
