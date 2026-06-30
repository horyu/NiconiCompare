import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  STORAGE_KEYS
} from "../../lib/constants"
import type { StorageShape } from "../../lib/types"
import type { StorageDataByKey } from "../services/storage"
import { handleExportData, handleImportData } from "./data"

const { readAllStorageMock, setStorageDataMock } = vi.hoisted(() => ({
  readAllStorageMock: vi.fn(),
  setStorageDataMock: vi.fn()
}))

vi.mock("../services/storage", () => ({
  readAllStorage: readAllStorageMock,
  setStorageData: setStorageDataMock
}))

const getFirstSetStoragePayload = (): Partial<StorageDataByKey> => {
  const firstCall = setStorageDataMock.mock.calls[0] as
    | [Partial<StorageDataByKey>]
    | undefined
  if (!firstCall) {
    throw new Error("setStorageData was not called")
  }
  const [payload] = firstCall
  return payload
}

describe("handleImportData schemaVersion control", () => {
  beforeEach(() => {
    readAllStorageMock.mockReset()
    setStorageDataMock.mockReset()
  })

  it("schemaVersion が未定義なら現行バージョンで補完すること", async () => {
    const input = {
      [STORAGE_KEYS.meta]: {
        lastReplayEventId: 1,
        lastCleanupAt: 0
      }
    } as Partial<StorageShape>

    await handleImportData(input)

    expect(setStorageDataMock).toHaveBeenCalledTimes(1)
    const payload = getFirstSetStoragePayload()
    expect(payload.meta?.schemaVersion).toBe(DEFAULT_META.schemaVersion)
  })

  it("schemaVersion が現行より新しい場合は拒否すること", async () => {
    const input = {
      [STORAGE_KEYS.meta]: {
        ...DEFAULT_META,
        schemaVersion: "2.0.0"
      }
    } as Partial<StorageShape>

    await expect(handleImportData(input)).rejects.toThrow(
      "より新しいため読み込めません"
    )
    expect(setStorageDataMock).not.toHaveBeenCalled()
  })

  it("schemaVersion が古い場合はマイグレーション未実装として拒否すること", async () => {
    const input = {
      [STORAGE_KEYS.meta]: {
        ...DEFAULT_META,
        schemaVersion: "0.9.0"
      }
    } as Partial<StorageShape>

    await expect(handleImportData(input)).rejects.toThrow(
      "マイグレーションが未実装"
    )
    expect(setStorageDataMock).not.toHaveBeenCalled()
  })

  it("schemaVersion の形式が不正な場合は拒否すること", async () => {
    const input = {
      [STORAGE_KEYS.meta]: {
        ...DEFAULT_META,
        schemaVersion: "v1"
      }
    } as Partial<StorageShape>

    await expect(handleImportData(input)).rejects.toThrow(
      "インポートデータが不正です"
    )
    expect(setStorageDataMock).not.toHaveBeenCalled()
  })

  it("schemaVersion が文字列以外の場合は拒否すること", async () => {
    const input = {
      [STORAGE_KEYS.meta]: {
        ...DEFAULT_META,
        schemaVersion: 1
      }
    } as unknown as Partial<StorageShape>

    await expect(handleImportData(input)).rejects.toThrow(
      "インポートデータが不正です"
    )
    expect(setStorageDataMock).not.toHaveBeenCalled()
  })

  it("schemaVersion が現行と一致する場合は取り込めること", async () => {
    const input = {
      [STORAGE_KEYS.meta]: {
        ...DEFAULT_META,
        schemaVersion: DEFAULT_META.schemaVersion
      },
      [STORAGE_KEYS.settings]: {
        recentWindowSize: 5,
        popupRecentCount: 5,
        overlayAndCaptureEnabled: true,
        overlayAutoCloseMs: 2000,
        showClosedOverlayVerdict: true,
        showPopupVideoVerdictCounts: false,
        showEventThumbnails: true,
        activeCategoryId: DEFAULT_CATEGORY_ID,
        glicko: {
          rating: 1500,
          rd: 350,
          volatility: 0.06
        }
      }
    } as Partial<StorageShape>

    await handleImportData(input)

    expect(setStorageDataMock).toHaveBeenCalledTimes(1)
    const payload = getFirstSetStoragePayload()
    expect(payload.meta?.schemaVersion).toBe(DEFAULT_META.schemaVersion)
  })

  it("currentVideoId は recentWindow から除外して再構築すること", async () => {
    const input = {
      [STORAGE_KEYS.settings]: {
        recentWindowSize: 2,
        popupRecentCount: 5,
        overlayAndCaptureEnabled: true,
        overlayAutoCloseMs: 2000,
        showClosedOverlayVerdict: true,
        showPopupVideoVerdictCounts: false,
        showEventThumbnails: true,
        activeCategoryId: DEFAULT_CATEGORY_ID,
        glicko: {
          rating: 1500,
          rd: 350,
          volatility: 0.06
        }
      },
      [STORAGE_KEYS.state]: {
        currentVideoId: "v3",
        pinnedOpponentVideoId: "",
        recentWindow: ["v3", "v2"]
      },
      [STORAGE_KEYS.videos]: {
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
      },
      [STORAGE_KEYS.events]: {
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
            currentVideoId: "v3",
            opponentVideoId: "v2",
            verdict: "same",
            disabled: false,
            categoryId: DEFAULT_CATEGORY_ID
          }
        ],
        nextId: 3
      }
    } as Partial<StorageShape>

    await handleImportData(input)

    const payload = getFirstSetStoragePayload()
    expect(payload.state?.recentWindow).toEqual(["v2", "v1"])
  })
})

describe("handleExportData", () => {
  beforeEach(() => {
    readAllStorageMock.mockReset()
    setStorageDataMock.mockReset()
  })

  it("Storage 読み取り失敗時に空データへ fallback せず失敗させること", async () => {
    readAllStorageMock.mockRejectedValue(new Error("storage unavailable"))

    await expect(handleExportData()).rejects.toThrow("storage unavailable")
  })

  it("Storage から読めた値を export 形式で返すこと", async () => {
    const data: StorageDataByKey = {
      settings: DEFAULT_SETTINGS,
      state: DEFAULT_STATE,
      videos: {},
      authors: {},
      events: DEFAULT_EVENTS_BUCKET,
      ratings: {},
      meta: DEFAULT_META,
      categories: DEFAULT_CATEGORIES
    }
    readAllStorageMock.mockResolvedValue(data)

    await expect(handleExportData()).resolves.toEqual({
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.state]: DEFAULT_STATE,
      [STORAGE_KEYS.videos]: {},
      [STORAGE_KEYS.authors]: {},
      [STORAGE_KEYS.events]: DEFAULT_EVENTS_BUCKET,
      [STORAGE_KEYS.ratings]: {},
      [STORAGE_KEYS.meta]: DEFAULT_META,
      [STORAGE_KEYS.categories]: DEFAULT_CATEGORIES
    })
  })
})
