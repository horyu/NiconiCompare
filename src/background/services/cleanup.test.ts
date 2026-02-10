import { beforeEach, describe, expect, it, vi } from "vitest"

import { performCleanup } from "./cleanup"
import type { StorageDataByKey } from "./storage"

const { getStorageDataMock, setStorageDataMock } = vi.hoisted(() => ({
  getStorageDataMock: vi.fn(),
  setStorageDataMock: vi.fn()
}))

vi.mock("./storage", () => ({
  getStorageData: getStorageDataMock,
  setStorageData: setStorageDataMock
}))

describe("performCleanup", () => {
  beforeEach(() => {
    getStorageDataMock.mockReset()
    setStorageDataMock.mockReset()
    vi.restoreAllMocks()
  })

  it("参照されない動画に紐づく authors を削除すること", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_735_000_000_000)
    const storage: Pick<
      StorageDataByKey,
      "events" | "videos" | "authors" | "ratings" | "meta" | "state"
    > = {
      events: {
        items: [
          {
            id: 1,
            timestamp: 1000,
            currentVideoId: "v1",
            opponentVideoId: "v2",
            verdict: "better",
            disabled: false,
            categoryId: "cat1"
          }
        ],
        nextId: 2
      },
      videos: {
        v1: {
          videoId: "v1",
          title: "video-1",
          authorUrl: "a1",
          thumbnailUrls: [],
          capturedAt: 10
        },
        v2: {
          videoId: "v2",
          title: "video-2",
          authorUrl: "a2",
          thumbnailUrls: [],
          capturedAt: 20
        },
        v3: {
          videoId: "v3",
          title: "video-3",
          authorUrl: "a3",
          thumbnailUrls: [],
          capturedAt: 30
        }
      },
      authors: {
        a1: { authorUrl: "a1", name: "author-1", capturedAt: 10 },
        a2: { authorUrl: "a2", name: "author-2", capturedAt: 20 },
        a3: { authorUrl: "a3", name: "author-3", capturedAt: 30 },
        a4: { authorUrl: "a4", name: "author-4", capturedAt: 40 }
      },
      ratings: {
        cat1: {
          v1: {
            videoId: "v1",
            rating: 1600,
            rd: 120,
            volatility: 0.06,
            updatedFromEventId: 1
          },
          v2: {
            videoId: "v2",
            rating: 1400,
            rd: 120,
            volatility: 0.06,
            updatedFromEventId: 1
          },
          v3: {
            videoId: "v3",
            rating: 1300,
            rd: 120,
            volatility: 0.06,
            updatedFromEventId: 1
          }
        }
      },
      meta: {
        lastReplayEventId: 0,
        schemaVersion: "1.0.0",
        lastCleanupAt: 0
      },
      state: {
        currentVideoId: "",
        pinnedOpponentVideoId: "",
        recentWindow: []
      }
    }
    getStorageDataMock.mockResolvedValue(storage)

    await performCleanup()

    expect(setStorageDataMock).toHaveBeenCalledTimes(1)
    expect(setStorageDataMock).toHaveBeenCalledWith({
      videos: {
        v1: storage.videos.v1,
        v2: storage.videos.v2
      },
      ratings: {
        cat1: {
          v1: storage.ratings.cat1.v1,
          v2: storage.ratings.cat1.v2
        }
      },
      authors: {
        a1: storage.authors.a1,
        a2: storage.authors.a2
      },
      meta: {
        ...storage.meta,
        lastCleanupAt: 1_735_000_000_000
      }
    })
  })
})
