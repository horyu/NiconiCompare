import { describe, expect, it } from "vitest"

import { DEFAULT_CATEGORY_ID } from "../lib/constants"
import type { NcEventsBucket } from "../lib/types"
import {
  buildRecentEventVideoVerdictStats,
  buildRecentEvents,
  buildVideoVerdictStats
} from "./utils"

describe("buildVideoVerdictStats", () => {
  it("各動画の勝/引き分け/敗をカテゴリ単位で集計すること", () => {
    const events: NcEventsBucket = {
      nextId: 4,
      items: [
        {
          id: 1,
          timestamp: 1,
          currentVideoId: "v1",
          opponentVideoId: "v2",
          verdict: "better",
          disabled: false,
          categoryId: DEFAULT_CATEGORY_ID
        },
        {
          id: 2,
          timestamp: 2,
          currentVideoId: "v1",
          opponentVideoId: "v3",
          verdict: "same",
          disabled: false,
          categoryId: DEFAULT_CATEGORY_ID
        },
        {
          id: 3,
          timestamp: 3,
          currentVideoId: "v2",
          opponentVideoId: "v3",
          verdict: "worse",
          disabled: true,
          categoryId: DEFAULT_CATEGORY_ID
        }
      ]
    }

    const stats = buildVideoVerdictStats(
      events,
      DEFAULT_CATEGORY_ID,
      DEFAULT_CATEGORY_ID
    )

    expect(stats.v1).toEqual({ wins: 1, draws: 1, losses: 0 })
    expect(stats.v2).toEqual({ wins: 0, draws: 0, losses: 1 })
    expect(stats.v3).toEqual({ wins: 0, draws: 1, losses: 0 })
  })

  it("対象外カテゴリのイベントを除外すること", () => {
    const events: NcEventsBucket = {
      nextId: 3,
      items: [
        {
          id: 1,
          timestamp: 1,
          currentVideoId: "v1",
          opponentVideoId: "v2",
          verdict: "better",
          disabled: false,
          categoryId: "cat-a"
        },
        {
          id: 2,
          timestamp: 2,
          currentVideoId: "v1",
          opponentVideoId: "v2",
          verdict: "worse",
          disabled: false,
          categoryId: "cat-b"
        }
      ]
    }

    const stats = buildVideoVerdictStats(events, "cat-a", DEFAULT_CATEGORY_ID)

    expect(stats.v1).toEqual({ wins: 1, draws: 0, losses: 0 })
    expect(stats.v2).toEqual({ wins: 0, draws: 0, losses: 1 })
  })

  it("表示行ごとにその時点の勝敗数を返すこと", () => {
    const events: NcEventsBucket = {
      nextId: 5,
      items: [
        {
          id: 1,
          timestamp: 1,
          currentVideoId: "v1",
          opponentVideoId: "v2",
          verdict: "better",
          disabled: false,
          categoryId: DEFAULT_CATEGORY_ID
        },
        {
          id: 2,
          timestamp: 2,
          currentVideoId: "v1",
          opponentVideoId: "v3",
          verdict: "better",
          disabled: false,
          categoryId: DEFAULT_CATEGORY_ID
        },
        {
          id: 3,
          timestamp: 3,
          currentVideoId: "v2",
          opponentVideoId: "v1",
          verdict: "same",
          disabled: false,
          categoryId: DEFAULT_CATEGORY_ID
        },
        {
          id: 4,
          timestamp: 4,
          currentVideoId: "v3",
          opponentVideoId: "v1",
          verdict: "worse",
          disabled: false,
          categoryId: DEFAULT_CATEGORY_ID
        }
      ]
    }

    const recentEvents = buildRecentEvents(
      events,
      3,
      DEFAULT_CATEGORY_ID,
      DEFAULT_CATEGORY_ID
    )
    const perEvent = buildRecentEventVideoVerdictStats(
      events,
      recentEvents,
      DEFAULT_CATEGORY_ID,
      DEFAULT_CATEGORY_ID
    )

    // id:4 時点（最新）
    expect(perEvent[4]?.v1).toEqual({ wins: 3, draws: 1, losses: 0 })
    expect(perEvent[4]?.v3).toEqual({ wins: 0, draws: 0, losses: 2 })

    // id:3 時点（id:4 を巻き戻した後）
    expect(perEvent[3]?.v2).toEqual({ wins: 0, draws: 1, losses: 1 })
    expect(perEvent[3]?.v1).toEqual({ wins: 2, draws: 1, losses: 0 })

    // id:2 時点（id:4,3 を巻き戻した後）
    expect(perEvent[2]?.v1).toEqual({ wins: 2, draws: 0, losses: 0 })
    expect(perEvent[2]?.v3).toEqual({ wins: 0, draws: 0, losses: 1 })
  })
})
