import { describe, expect, it } from "vitest"

import type { CompareEvent, NcVideos } from "../../lib/types"
import {
  rebuildRecentWindowFromEvents,
  updateRecentWindow
} from "./recentWindow"

describe("updateRecentWindow", () => {
  const videos: NcVideos = {
    v1: {
      videoId: "v1",
      title: "video1",
      authorUrl: "author1",
      thumbnailUrls: [],
      capturedAt: 1
    },
    v2: {
      videoId: "v2",
      title: "video2",
      authorUrl: "author2",
      thumbnailUrls: [],
      capturedAt: 2
    },
    v3: {
      videoId: "v3",
      title: "video3",
      authorUrl: "author3",
      thumbnailUrls: [],
      capturedAt: 3
    }
  }

  it("candidatesを優先し、重複を除外してサイズ上限を守ること", () => {
    const result = updateRecentWindow(
      ["v1", "v2", "v3"],
      2,
      [undefined, "v3", "v2"],
      videos
    )

    expect(result).toEqual(["v3", "v2"])
  })

  it("動画が存在しない候補は無視すること", () => {
    const result = updateRecentWindow(["v1"], 2, ["missing", "v2"], videos)

    expect(result).toEqual(["v2", "v1"])
  })

  it("サイズが0以下でも最低1件は保持すること", () => {
    const result = updateRecentWindow([], 0, ["v1"], videos)

    expect(result).toEqual(["v1"])
  })
})

describe("rebuildRecentWindowFromEvents", () => {
  const videos: NcVideos = {
    v1: {
      videoId: "v1",
      title: "video1",
      authorUrl: "author1",
      thumbnailUrls: [],
      capturedAt: 1
    },
    v2: {
      videoId: "v2",
      title: "video2",
      authorUrl: "author2",
      thumbnailUrls: [],
      capturedAt: 2
    },
    v3: {
      videoId: "v3",
      title: "video3",
      authorUrl: "author3",
      thumbnailUrls: [],
      capturedAt: 3
    }
  }

  const events: CompareEvent[] = [
    {
      id: 1,
      timestamp: 1,
      currentVideoId: "v1",
      opponentVideoId: "v2",
      verdict: "better",
      disabled: false,
      categoryId: "default"
    },
    {
      id: 2,
      timestamp: 2,
      currentVideoId: "v3",
      opponentVideoId: "v1",
      verdict: "same",
      disabled: true,
      categoryId: "default"
    },
    {
      id: 3,
      timestamp: 3,
      currentVideoId: "v3",
      opponentVideoId: "v2",
      verdict: "worse",
      disabled: false,
      categoryId: "default"
    }
  ]

  it("最新のイベントから有効な動画を抽出すること", () => {
    const result = rebuildRecentWindowFromEvents(events, 2, videos)

    expect(result).toEqual(["v3", "v2"])
  })

  it("サイズが0以下の場合は空配列を返すこと", () => {
    expect(rebuildRecentWindowFromEvents(events, 0, videos)).toEqual([])
  })

  it("直近100件のイベントのみを走査すること", () => {
    const longEvents: CompareEvent[] = Array.from(
      { length: 120 },
      (_, index) => ({
        id: index + 1,
        timestamp: index + 1,
        // 101件目以降（index >= 100）は走査されないため、
        // index === 19 の v1 は含まれず、v2 のみが結果に残る
        currentVideoId: index === 19 ? "v1" : "v2",
        opponentVideoId: "v2",
        verdict: "better",
        disabled: false,
        categoryId: "default"
      })
    )

    const result = rebuildRecentWindowFromEvents(longEvents, 2, videos)

    expect(result).toEqual(["v2"])
  })

  it("存在しない動画IDは除外すること", () => {
    const result = rebuildRecentWindowFromEvents(
      [
        {
          id: 1,
          timestamp: 1,
          currentVideoId: "missing",
          opponentVideoId: "v2",
          verdict: "better",
          disabled: false,
          categoryId: "default"
        }
      ],
      2,
      videos
    )

    expect(result).toEqual(["v2"])
  })
})
