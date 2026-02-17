import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { buildShareExportFilename, buildShareHtml } from "./buildHtml"

const baseSnapshot: OptionsSnapshot = {
  settings: {
    ...DEFAULT_SETTINGS,
    activeCategoryId: "cat-a"
  },
  state: { ...DEFAULT_STATE },
  videos: {
    sm1: {
      videoId: "sm1",
      title: "動画A",
      authorUrl: "author:a",
      thumbnailUrls: ["https://example.com/a.jpg"],
      capturedAt: 100
    },
    sm2: {
      videoId: "sm2",
      title: "動画B",
      authorUrl: "author:b",
      thumbnailUrls: ["https://example.com/b.jpg"],
      capturedAt: 100
    },
    sm3: {
      videoId: "sm3",
      title: "動画C",
      authorUrl: "author:c",
      thumbnailUrls: [],
      capturedAt: 100
    }
  },
  authors: {
    "author:a": { authorUrl: "author:a", name: "投稿者A", capturedAt: 100 },
    "author:b": { authorUrl: "author:b", name: "投稿者B", capturedAt: 100 },
    "author:c": { authorUrl: "author:c", name: "投稿者C", capturedAt: 100 }
  },
  events: {
    nextId: 10,
    items: [
      {
        id: 1,
        timestamp: 1000,
        currentVideoId: "sm1",
        opponentVideoId: "sm2",
        verdict: "better",
        disabled: false,
        categoryId: "cat-a"
      },
      {
        id: 2,
        timestamp: 2000,
        currentVideoId: "sm2",
        opponentVideoId: "sm3",
        verdict: "same",
        disabled: false,
        categoryId: "cat-a"
      },
      {
        id: 3,
        timestamp: 3000,
        currentVideoId: "sm3",
        opponentVideoId: "sm1",
        verdict: "worse",
        disabled: true,
        categoryId: "cat-a"
      },
      {
        id: 4,
        timestamp: 4000,
        currentVideoId: "sm1",
        opponentVideoId: "sm3",
        verdict: "better",
        disabled: false,
        categoryId: "cat-b"
      }
    ]
  },
  ratings: {
    "cat-a": {
      sm1: {
        videoId: "sm1",
        rating: 1510,
        rd: 250,
        volatility: 0.06,
        updatedFromEventId: 2
      },
      sm2: {
        videoId: "sm2",
        rating: 1490,
        rd: 260,
        volatility: 0.06,
        updatedFromEventId: 2
      }
    },
    "cat-b": {}
  },
  meta: { ...DEFAULT_META },
  categories: {
    ...DEFAULT_CATEGORIES,
    items: {
      ...DEFAULT_CATEGORIES.items,
      "cat-a": { id: "cat-a", name: "カテゴリA", createdAt: 1 },
      "cat-b": { id: "cat-b", name: "カテゴリB", createdAt: 2 }
    },
    order: ["cat-a", "cat-b"],
    defaultId: "cat-a"
  }
}

const extractEmbeddedPayload = (html: string): Record<string, unknown> => {
  const pattern =
    /<script id="nc-share-data" type="application\/json">([\s\S]*?)<\/script>/
  const matched = pattern.exec(html)
  expect(matched).not.toBeNull()
  if (!matched) {
    throw new Error("payload script not found")
  }
  return JSON.parse(matched[1]) as Record<string, unknown>
}

describe("buildShareHtml", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 14, 12, 34, 56))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("指定カテゴリの有効イベントだけを埋め込むこと", () => {
    const html = buildShareHtml({ snapshot: baseSnapshot, categoryId: "cat-a" })
    const payload = extractEmbeddedPayload(html)
    const events = payload.events as Record<string, unknown>[]
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      timestamp: 2000,
      currentVideoId: "sm2",
      opponentVideoId: "sm3"
    })
    expect(events[1]).toMatchObject({
      timestamp: 1000,
      currentVideoId: "sm1",
      opponentVideoId: "sm2"
    })
    expect(events[0]).not.toHaveProperty("id")
    expect(events[1]).not.toHaveProperty("id")
  })

  it("カテゴリ内有効イベントに登場する全動画と必要情報を埋め込むこと", () => {
    const html = buildShareHtml({ snapshot: baseSnapshot, categoryId: "cat-a" })
    const payload = extractEmbeddedPayload(html)
    const videos = payload.videos as Record<string, unknown>[]
    const videoIds = videos
      .map((video) => String(video.videoId))
      .sort((left, right) => left.localeCompare(right))
    expect(videoIds).toEqual(["sm1", "sm2", "sm3"])
    const sm1 = videos.find((video) => video.videoId === "sm1")
    expect(sm1?.authorName).toBe("投稿者A")
    expect(sm1?.thumbnailUrl).toBe("https://example.com/a.jpg")
    expect(sm1?.videoUrl).toBe("https://www.nicovideo.jp/watch/sm1")
    expect(html).toContain('id="nc-share-data"')
  })
})

describe("buildShareExportFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 14, 12, 34, 56))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("カテゴリ名の禁止文字を除去してhtml拡張子で生成すること", () => {
    expect(buildShareExportFilename('a/b:c*?"<>|')).toBe(
      "NiconiCompareShare-abc-20260214123456.html"
    )
  })
})
