import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { STORAGE_KEYS } from "./constants"
import {
  hasWatchedStorageChange,
  useStorageChangeRefresh
} from "./useStorageChangeRefresh"

describe("hasWatchedStorageChange", () => {
  it("local storage の監視対象 key 変更だけを検出すること", () => {
    expect(
      hasWatchedStorageChange(
        { [STORAGE_KEYS.settings]: { newValue: {} } },
        "local",
        [STORAGE_KEYS.settings]
      )
    ).toBe(true)
    expect(
      hasWatchedStorageChange(
        { [STORAGE_KEYS.settings]: { newValue: {} } },
        "sync",
        [STORAGE_KEYS.settings]
      )
    ).toBe(false)
    expect(
      hasWatchedStorageChange({ unrelated: { newValue: {} } }, "local", [
        STORAGE_KEYS.settings
      ])
    ).toBe(false)
  })
})

describe("useStorageChangeRefresh", () => {
  let addListenerMock: ReturnType<typeof vi.fn>
  let removeListenerMock: ReturnType<typeof vi.fn>
  let addedListener:
    | Parameters<typeof chrome.storage.onChanged.addListener>[0]
    | undefined

  beforeEach(() => {
    addedListener = undefined
    addListenerMock = vi.fn(
      (
        listener: Parameters<typeof chrome.storage.onChanged.addListener>[0]
      ) => {
        addedListener = listener
      }
    )
    removeListenerMock = vi.fn()
    const globalWithChrome = globalThis as typeof globalThis & {
      chrome: typeof chrome
    }
    globalWithChrome.chrome = {
      storage: {
        onChanged: {
          addListener: addListenerMock,
          removeListener: removeListenerMock
        }
      }
    } as unknown as typeof chrome
  })

  it("監視対象 key の変更で refresh を実行すること", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() =>
      useStorageChangeRefresh({
        keys: [STORAGE_KEYS.settings],
        refresh
      })
    )
    addedListener?.({ [STORAGE_KEYS.settings]: { newValue: {} } }, "local")
    await Promise.resolve()

    expect(refresh).toHaveBeenCalledTimes(1)
    unmount()
    expect(removeListenerMock).toHaveBeenCalledWith(addedListener)
  })

  it("実行中の連続変更は後続1回へ合流すること", async () => {
    let resolveFirst: (() => void) | undefined
    const refresh = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValue(undefined)

    renderHook(() =>
      useStorageChangeRefresh({
        keys: [STORAGE_KEYS.settings],
        refresh
      })
    )
    addedListener?.({ [STORAGE_KEYS.settings]: { newValue: {} } }, "local")
    addedListener?.({ [STORAGE_KEYS.settings]: { newValue: {} } }, "local")
    addedListener?.({ [STORAGE_KEYS.settings]: { newValue: {} } }, "local")

    expect(refresh).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst?.()
      await Promise.resolve()
    })

    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
