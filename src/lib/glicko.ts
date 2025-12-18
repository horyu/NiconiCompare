import rate from "glicko2-lite"

import type { NcSettings, RatingSnapshot, Verdict } from "./types"

export function updatePairRatings(params: {
  settings: NcSettings
  left: RatingSnapshot
  right: RatingSnapshot
  verdict: Verdict
  eventId: number
}): { left: RatingSnapshot; right: RatingSnapshot } {
  const { settings, left, right, verdict, eventId } = params
  const baseOptions = {
    rating: settings.glicko.rating,
    tau: 0.5
  }

  const leftScore = verdict === "worse" ? 1 : verdict === "better" ? 0 : 0.5
  const rightScore = verdict === "better" ? 1 : verdict === "worse" ? 0 : 0.5

  const leftResult = rate(
    left.rating,
    left.rd,
    left.volatility,
    [[right.rating, right.rd, leftScore]],
    baseOptions
  )

  const rightResult = rate(
    right.rating,
    right.rd,
    right.volatility,
    [[left.rating, left.rd, rightScore]],
    baseOptions
  )

  return {
    left: {
      videoId: left.videoId,
      rating: leftResult.rating,
      rd: leftResult.rd,
      volatility: leftResult.vol,
      updatedFromEventId: eventId
    },
    right: {
      videoId: right.videoId,
      rating: rightResult.rating,
      rd: rightResult.rd,
      volatility: rightResult.vol,
      updatedFromEventId: eventId
    }
  }
}
