import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_CATEGORY_ID,
  DEFAULT_META,
  STORAGE_KEYS
} from "../../lib/constants"
import type { StorageShape } from "../../lib/types"
import type { StorageDataByKey } from "../services/storage"
import { handleImportData } from "./data"

const { setStorageDataMock } = vi.hoisted(() => ({
  setStorageDataMock: vi.fn()
}))

vi.mock("../services/storage", () => ({
  readAllStorage: vi.fn(),
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
})
