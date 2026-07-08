import { describe, expect, it } from "vitest"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import type {
  AuthorProfile,
  CompareEvent,
  RatingSnapshot,
  VideoSnapshot
} from "../../lib/types"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import {
  buildLastEventByVideo,
  buildVerdictCountsByVideo,
  buildVideoExportRows,
  filterVideos,
  sortVideos,
  type VideoSortKey,
  type VideoSortOrder
} from "./videos"

const videos: VideoSnapshot[] = [
  createVideo("v3", "Charlie", "author-c"),
  createVideo("v1", "Alpha", "author-a"),
  createVideo("v2", "Bravo", "author-b"),
  createVideo("v4", "Delta", "author-missing")
]

const authors: Record<string, AuthorProfile> = {
  "author-a": createAuthor("author-a", "Alice"),
  "author-b": createAuthor("author-b", "Bob"),
  "author-c": createAuthor("author-c", "Carol")
}

const ratingsByCategory: Record<string, RatingSnapshot> = {
  v1: createRating("v1", 1600, 90),
  v2: createRating("v2", 1500, 70),
  v3: createRating("v3", 1700, 110),
  v4: createRating("v4", 1500, 70)
}

const lastEventByVideo = new Map([
  ["v1", 300],
  ["v2", 100],
  ["v3", 200]
])

const verdictCountsByVideo = new Map([
  ["v1", { wins: 2, draws: 1, losses: 0 }],
  ["v2", { wins: 1, draws: 0, losses: 3 }],
  ["v3", { wins: 3, draws: 2, losses: 1 }]
])

const events: CompareEvent[] = [
  createEvent({
    id: 1,
    timestamp: new Date(2024, 0, 2, 3, 4, 5).getTime(),
    currentVideoId: "v1",
    opponentVideoId: "v2",
    verdict: "better"
  }),
  createEvent({
    id: 2,
    timestamp: new Date(2024, 0, 3, 3, 4, 5).getTime(),
    currentVideoId: "v2",
    opponentVideoId: "v3",
    verdict: "same"
  }),
  createEvent({
    id: 3,
    timestamp: new Date(2024, 0, 4, 3, 4, 5).getTime(),
    currentVideoId: "v3",
    opponentVideoId: "v1",
    verdict: "worse",
    disabled: true
  }),
  createEvent({
    id: 4,
    timestamp: new Date(2024, 0, 5, 3, 4, 5).getTime(),
    currentVideoId: "v4",
    opponentVideoId: "v1",
    verdict: "worse",
    categoryId: "cat-other"
  })
]

describe("sortVideos", () => {
  it.each([
    ["title", "asc", ["v1", "v2", "v3", "v4"]],
    ["title", "desc", ["v4", "v3", "v2", "v1"]],
    ["author", "asc", ["v4", "v1", "v2", "v3"]],
    ["author", "desc", ["v3", "v2", "v1", "v4"]],
    ["rating", "asc", ["v2", "v4", "v1", "v3"]],
    ["rating", "desc", ["v3", "v1", "v2", "v4"]],
    ["rd", "asc", ["v2", "v4", "v1", "v3"]],
    ["rd", "desc", ["v3", "v1", "v2", "v4"]],
    ["evalCount", "asc", ["v4", "v1", "v2", "v3"]],
    ["evalCount", "desc", ["v3", "v2", "v1", "v4"]],
    ["wins", "asc", ["v4", "v2", "v1", "v3"]],
    ["wins", "desc", ["v3", "v1", "v2", "v4"]],
    ["losses", "asc", ["v1", "v4", "v3", "v2"]],
    ["losses", "desc", ["v2", "v3", "v1", "v4"]],
    ["lastVerdict", "asc", ["v4", "v2", "v3", "v1"]],
    ["lastVerdict", "desc", ["v1", "v3", "v2", "v4"]]
  ] satisfies [VideoSortKey, VideoSortOrder, string[]][])(
    "%s の %s で並び替えること",
    (sort, order, expectedVideoIds) => {
      expect(sortVideoIds(sort, order)).toEqual(expectedVideoIds)
    }
  )

  it("同値時は並び順指定に関係なく videoId 昇順にすること", () => {
    expect(sortVideoIds("rating", "asc").slice(0, 2)).toEqual(["v2", "v4"])
    expect(sortVideoIds("rating", "desc").slice(2)).toEqual(["v2", "v4"])
  })

  it("未知のソートキーは rating として扱うこと", () => {
    expect(sortVideoIds("unknown", "desc")).toEqual(["v3", "v1", "v2", "v4"])
  })

  it("入力配列を変更しないこと", () => {
    sortVideoIds("title", "asc")

    expect(videos.map((video) => video.videoId)).toEqual([
      "v3",
      "v1",
      "v2",
      "v4"
    ])
  })
})

describe("buildLastEventByVideo", () => {
  it("カテゴリ別に無効イベントを除外して最終判定日時を集計すること", () => {
    const map = buildLastEventByVideo(events, "cat-a", "cat-a")

    expect(map.get("v1")).toBe(new Date(2024, 0, 2, 3, 4, 5).getTime())
    expect(map.get("v2")).toBe(new Date(2024, 0, 3, 3, 4, 5).getTime())
    expect(map.get("v3")).toBe(new Date(2024, 0, 3, 3, 4, 5).getTime())
    expect(map.has("v4")).toBe(false)
  })
})

describe("buildVerdictCountsByVideo", () => {
  it("カテゴリ別に勝敗数を動画単位で集計すること", () => {
    const map = buildVerdictCountsByVideo(events, "cat-a", "cat-a")

    expect(map.get("v1")).toEqual({ wins: 1, draws: 0, losses: 0 })
    expect(map.get("v2")).toEqual({ wins: 0, draws: 1, losses: 1 })
    expect(map.get("v3")).toEqual({ wins: 0, draws: 1, losses: 0 })
    expect(map.has("v4")).toBe(false)
  })
})

describe("filterVideos", () => {
  it("rating のある動画だけを検索語・投稿者で絞り込むこと", () => {
    const result = filterVideos({
      videos: {
        v1: videos[1],
        v2: videos[2],
        v3: videos[0],
        v4: videos[3],
        unrated: createVideo("unrated", "Alpha unrated", "author-a")
      },
      authors,
      ratingsByCategory,
      lastEventByVideo,
      verdictCountsByVideo,
      search: "a",
      author: "ali",
      sort: "title",
      order: "asc"
    })

    expect(result.map((video) => video.videoId)).toEqual(["v1"])
  })
})

describe("buildVideoExportRows", () => {
  it("動画一覧の export 行を生成すること", () => {
    const snapshot = createSnapshot()
    const rows = buildVideoExportRows({
      videos: [snapshot.videos.v1, snapshot.videos.v2],
      snapshot,
      ratingsByCategory,
      lastEventByVideo: new Map([
        ["v1", new Date(2024, 0, 2, 3, 4, 5).getTime()]
      ]),
      verdictCountsByVideo
    })

    expect(rows).toEqual([
      {
        videoId: "v1",
        thumbnailUrl: "https://example.com/v1.jpg",
        videoUrl: "https://www.nicovideo.jp/watch/v1",
        title: "Alpha",
        author: "Alice",
        rating: "1600",
        rd: "90",
        total: "3",
        wins: "2",
        draws: "1",
        losses: "0",
        lastVerdictAt: "2024/01/02 03:04:05"
      },
      {
        videoId: "v2",
        thumbnailUrl: "",
        videoUrl: "https://www.nicovideo.jp/watch/v2",
        title: "Bravo",
        author: "Bob",
        rating: "1500",
        rd: "70",
        total: "4",
        wins: "1",
        draws: "0",
        losses: "3",
        lastVerdictAt: ""
      }
    ])
  })
})

function sortVideoIds(sort: string, order: VideoSortOrder): string[] {
  return sortVideos({
    videos,
    sort,
    order,
    authors,
    ratingsByCategory,
    lastEventByVideo,
    verdictCountsByVideo
  }).map((video) => video.videoId)
}

function createVideo(
  videoId: string,
  title: string,
  authorUrl: string
): VideoSnapshot {
  return {
    videoId,
    title,
    authorUrl,
    thumbnailUrls: [],
    capturedAt: 1
  }
}

function createAuthor(authorUrl: string, name: string): AuthorProfile {
  return {
    authorUrl,
    name,
    capturedAt: 1
  }
}

function createRating(
  videoId: string,
  rating: number,
  rd: number
): RatingSnapshot {
  return {
    videoId,
    rating,
    rd,
    volatility: 0.06,
    updatedFromEventId: 1
  }
}

function createEvent({
  id,
  timestamp,
  currentVideoId,
  opponentVideoId,
  verdict,
  disabled = false,
  categoryId = "cat-a"
}: {
  id: number
  timestamp: number
  currentVideoId: string
  opponentVideoId: string
  verdict: CompareEvent["verdict"]
  disabled?: boolean
  categoryId?: string
}): CompareEvent {
  return {
    id,
    timestamp,
    currentVideoId,
    opponentVideoId,
    verdict,
    disabled,
    categoryId
  }
}

function createSnapshot(): OptionsSnapshot {
  return {
    settings: DEFAULT_SETTINGS,
    state: DEFAULT_STATE,
    videos: {
      v1: {
        ...videos[1],
        thumbnailUrls: ["https://example.com/v1.jpg"]
      },
      v2: videos[2]
    },
    authors,
    events: { items: events, nextId: 5 },
    ratings: { "cat-a": ratingsByCategory },
    meta: {
      lastReplayEventId: 0,
      schemaVersion: "1.0.0",
      lastCleanupAt: 0
    },
    categories: DEFAULT_CATEGORIES
  }
}
