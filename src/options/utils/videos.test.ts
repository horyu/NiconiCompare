import { describe, expect, it } from "vitest"

import type {
  AuthorProfile,
  RatingSnapshot,
  VideoSnapshot
} from "../../lib/types"
import { sortVideos, type VideoSortKey, type VideoSortOrder } from "./videos"

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
