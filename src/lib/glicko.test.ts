import { describe, expect, it } from "vitest"

import { updatePairRatings } from "./glicko"
import type { NcSettings, RatingSnapshot } from "./types"

describe("glicko", () => {
  const defaultSettings: NcSettings = {
    recentWindowSize: 100,
    popupRecentCount: 10,
    overlayAndCaptureEnabled: true,
    overlayAutoCloseMs: 5000,
    showClosedOverlayVerdict: true,
    showPopupVideoVerdictCounts: false,
    showEventThumbnails: true,
    activeCategoryId: "default",
    glicko: {
      rating: 1500,
      rd: 350,
      volatility: 0.06
    }
  }

  const createRatingSnapshot = (
    videoId: string,
    overrides?: Partial<RatingSnapshot>
  ): RatingSnapshot => ({
    videoId,
    rating: 1500,
    rd: 350,
    volatility: 0.06,
    updatedFromEventId: 0,
    ...overrides
  })

  describe("updatePairRatings", () => {
    it("全ての判定タイプでエラーなく実行され、有効なレーティング更新を返すこと", () => {
      const left = createRatingSnapshot("video1")
      const right = createRatingSnapshot("video2")

      // Test all verdict types: better, worse, same
      const verdicts = ["better", "worse", "same"] as const

      verdicts.forEach((verdict) => {
        const result = updatePairRatings({
          settings: defaultSettings,
          left,
          right,
          verdict,
          eventId: 1
        })

        // Verify the function returns valid results
        expect(result.left.videoId).toBe("video1")
        expect(result.right.videoId).toBe("video2")
        expect(typeof result.left.rating).toBe("number")
        expect(typeof result.right.rating).toBe("number")
        expect(typeof result.left.rd).toBe("number")
        expect(typeof result.right.rd).toBe("number")
        expect(typeof result.left.volatility).toBe("number")
        expect(typeof result.right.volatility).toBe("number")
        expect(result.left.updatedFromEventId).toBe(1)
        expect(result.right.updatedFromEventId).toBe(1)
      })
    })
  })
})
