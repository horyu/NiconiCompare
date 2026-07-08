import { describe, expect, it } from "vitest"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import type {
  AuthorProfile,
  CompareEvent,
  VideoSnapshot
} from "../../lib/types"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { buildEventExportRows, filterEvents } from "./events"

const videos: Record<string, VideoSnapshot> = {
  v1: createVideo("v1", "Alpha", "author-a"),
  v2: createVideo("v2", "Bravo", "author-b"),
  v3: createVideo("v3", "Charlie", "author-c")
}

const authors: Record<string, AuthorProfile> = {
  "author-a": createAuthor("author-a", "Alice"),
  "author-b": createAuthor("author-b", "Bob"),
  "author-c": createAuthor("author-c", "Carol")
}

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
    currentVideoId: "v1",
    opponentVideoId: "v3",
    verdict: "worse",
    categoryId: "cat-other"
  })
]

describe("filterEvents", () => {
  it("カテゴリ・無効化状態・判定で絞り込み、id 降順にすること", () => {
    const result = filterEvents({
      events,
      includeDeleted: false,
      verdict: "all",
      categoryId: "cat-a",
      defaultCategoryId: "cat-a",
      search: "",
      videos,
      authors
    })

    expect(result.map((event) => event.id)).toEqual([2, 1])
  })

  it("無効化済みを含めた上で判定種別で絞り込むこと", () => {
    const result = filterEvents({
      events,
      includeDeleted: true,
      verdict: "worse",
      categoryId: "cat-a",
      defaultCategoryId: "cat-a",
      search: "",
      videos,
      authors
    })

    expect(result.map((event) => event.id)).toEqual([3])
  })

  it("動画ID・タイトル・投稿者・イベントIDで検索できること", () => {
    const byTitle = filterEventIds("charlie")
    const byAuthor = filterEventIds("alice")
    const byEventId = filterEvents({
      events: [
        createEvent({
          id: 42,
          timestamp: 1,
          currentVideoId: "aa",
          opponentVideoId: "bb",
          verdict: "better"
        })
      ],
      includeDeleted: false,
      verdict: "all",
      categoryId: "cat-a",
      defaultCategoryId: "cat-a",
      search: "42",
      videos: {},
      authors: {}
    }).map((event) => event.id)

    expect(byTitle).toEqual([2])
    expect(byAuthor).toEqual([1])
    expect(byEventId).toEqual([42])
  })
})

describe("buildEventExportRows", () => {
  it("イベント一覧の export 行を生成すること", () => {
    const rows = buildEventExportRows({
      events: [events[0], events[2]],
      snapshot: createSnapshot()
    })

    expect(rows).toEqual([
      {
        id: "1",
        occurredAt: "2024/01/02 03:04:05",
        status: "有効",
        currentVideoId: "v1",
        currentVideoUrl: "https://www.nicovideo.jp/watch/v1",
        currentVideoTitle: "Alpha",
        currentVideoAuthor: "Alice",
        opponentVideoId: "v2",
        opponentVideoUrl: "https://www.nicovideo.jp/watch/v2",
        opponentVideoTitle: "Bravo",
        opponentVideoAuthor: "Bob",
        verdict: "勝ち"
      },
      {
        id: "3",
        occurredAt: "2024/01/04 03:04:05",
        status: "無効",
        currentVideoId: "v3",
        currentVideoUrl: "https://www.nicovideo.jp/watch/v3",
        currentVideoTitle: "Charlie",
        currentVideoAuthor: "Carol",
        opponentVideoId: "v1",
        opponentVideoUrl: "https://www.nicovideo.jp/watch/v1",
        opponentVideoTitle: "Alpha",
        opponentVideoAuthor: "Alice",
        verdict: "負け"
      }
    ])
  })
})

function filterEventIds(search: string): number[] {
  return filterEvents({
    events,
    includeDeleted: false,
    verdict: "all",
    categoryId: "cat-a",
    defaultCategoryId: "cat-a",
    search,
    videos,
    authors
  }).map((event) => event.id)
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
    videos,
    authors,
    events: { items: events, nextId: 5 },
    ratings: {},
    meta: {
      lastReplayEventId: 0,
      schemaVersion: "1.0.0",
      lastCleanupAt: 0
    },
    categories: DEFAULT_CATEGORIES
  }
}
