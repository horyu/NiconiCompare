import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  STORAGE_KEYS
} from "../../lib/constants"
import { handleRecordEvent } from "../handlers/event"
import type { StorageDataByKey } from "./storage"
import { getStorageData, setStorageData, withStorageUpdates } from "./storage"

const storedData: Record<string, unknown> = {}
const storageGet = vi.fn((keys: string[]) =>
  Promise.resolve(
    Object.fromEntries(
      keys
        .filter((key) => storedData[key] !== undefined)
        .map((key) => [key, structuredClone(storedData[key])])
    )
  )
)
const storageSet = vi.fn((updates: Record<string, unknown>) => {
  Object.assign(storedData, structuredClone(updates))
  return Promise.resolve()
})

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: storageGet,
      set: storageSet
    }
  }
})

const setStoredSettings = (popupRecentCount: number): void => {
  storedData[STORAGE_KEYS.settings] = {
    ...DEFAULT_SETTINGS,
    popupRecentCount
  }
}

const getStoredSettings = (): StorageDataByKey["settings"] => {
  // oxlint-disable-next-line no-unsafe-type-assertion
  return storedData[STORAGE_KEYS.settings] as StorageDataByKey["settings"]
}

const waitForNextTask = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe("storage transaction queue", () => {
  beforeEach(() => {
    for (const key of Object.keys(storedData)) {
      delete storedData[key]
    }
    setStoredSettings(5)
    storageGet.mockClear()
    storageSet.mockClear()
  })

  it("同時更新を直列化して先行更新を失わないこと", async () => {
    let invocation = 0
    const waits = [waitForNextTask(), Promise.resolve()]
    const increment = (): Promise<number | undefined> =>
      withStorageUpdates({
        keys: ["settings"],
        context: "test:increment",
        update: async ({ settings }) => {
          await waits[invocation]
          invocation += 1
          return {
            updates: {
              settings: {
                ...settings,
                popupRecentCount: settings.popupRecentCount + 1
              }
            },
            result: settings.popupRecentCount + 1
          }
        }
      })

    await expect(Promise.all([increment(), increment()])).resolves.toEqual([
      6, 7
    ])
    expect(getStoredSettings().popupRecentCount).toBe(7)
  })

  it("失敗した transaction の後も後続 transaction を実行すること", async () => {
    await expect(
      withStorageUpdates({
        keys: ["settings"],
        context: "test:failure",
        update: () => {
          throw new Error("expected failure")
        }
      })
    ).rejects.toThrow("expected failure")

    await withStorageUpdates({
      keys: ["settings"],
      context: "test:after-failure",
      update: ({ settings }) => ({
        updates: {
          settings: {
            ...settings,
            popupRecentCount: 10
          }
        }
      })
    })

    expect(getStoredSettings().popupRecentCount).toBe(10)
  })

  it("更新がない transaction では Storage へ書き込まないこと", async () => {
    await withStorageUpdates({
      keys: ["settings"],
      context: "test:no-update",
      update: () => ({ updates: {} })
    })

    expect(storageSet).not.toHaveBeenCalled()
  })

  it("直接書き込みを先行 transaction の後に実行すること", async () => {
    const transaction = withStorageUpdates({
      keys: ["settings"],
      context: "test:before-direct-write",
      update: async ({ settings }) => {
        await waitForNextTask()
        return {
          updates: {
            settings: {
              ...settings,
              popupRecentCount: 6
            }
          }
        }
      }
    })
    const directWrite = setStorageData({
      settings: {
        ...DEFAULT_SETTINGS,
        popupRecentCount: 20
      }
    })

    await Promise.all([transaction, directWrite])

    expect(getStoredSettings().popupRecentCount).toBe(20)
  })

  it("読み取りを先行 transaction の後に実行すること", async () => {
    const transaction = withStorageUpdates({
      keys: ["settings"],
      context: "test:before-read",
      update: async ({ settings }) => {
        await waitForNextTask()
        return {
          updates: {
            settings: {
              ...settings,
              popupRecentCount: 6
            }
          }
        }
      }
    })
    const read = getStorageData(["settings"])

    const [, snapshot] = await Promise.all([transaction, read])

    expect(snapshot.settings.popupRecentCount).toBe(6)
  })

  it("同時イベント登録でも一意な ID で両方を保存すること", async () => {
    storedData[STORAGE_KEYS.events] = structuredClone(DEFAULT_EVENTS_BUCKET)
    storedData[STORAGE_KEYS.state] = structuredClone(DEFAULT_STATE)
    storedData[STORAGE_KEYS.ratings] = {}
    storedData[STORAGE_KEYS.videos] = {}

    await Promise.all([
      handleRecordEvent({
        currentVideoId: "v1",
        opponentVideoId: "v2",
        verdict: "better"
      }),
      handleRecordEvent({
        currentVideoId: "v2",
        opponentVideoId: "v3",
        verdict: "same"
      })
    ])

    // oxlint-disable-next-line no-unsafe-type-assertion
    const events = storedData[STORAGE_KEYS.events] as StorageDataByKey["events"]
    expect(events.items.map((event) => event.id)).toEqual([1, 2])
    expect(events.nextId).toBe(3)
  })
})
