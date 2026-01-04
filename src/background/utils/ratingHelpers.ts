import { DEFAULT_CATEGORY_ID } from "../../lib/constants"
import { updatePairRatings } from "../../lib/glicko"
import type {
  CompareEvent,
  NcRatings,
  NcSettings,
  RatingSnapshot
} from "../../lib/types"

export function getOrCreateRatingSnapshot(
  ratingsByVideo: Record<string, RatingSnapshot>,
  videoId: string,
  settings: NcSettings
): RatingSnapshot {
  const existing = ratingsByVideo[videoId]
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
    const categoryId = event.categoryId ?? DEFAULT_CATEGORY_ID
    if (!nextRatings[categoryId]) {
      nextRatings[categoryId] = {}
    }
    const categoryRatings = nextRatings[categoryId]
    const leftRating = getOrCreateRatingSnapshot(
      categoryRatings,
      event.currentVideoId,
      settings
    )
    const rightRating = getOrCreateRatingSnapshot(
      categoryRatings,
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
    categoryRatings[left.videoId] = left
    categoryRatings[right.videoId] = right
  }

  return nextRatings
}
