import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import type * as MessagesModule from "../../lib/messages"
import type { BackgroundResponse } from "../../lib/messages"
import type { OptionsSnapshot } from "./useOptionsData"
import { useOptionsData } from "./useOptionsData"

const { sendNcMessageMock } = vi.hoisted(() => ({
  sendNcMessageMock: vi.fn()
}))

vi.mock("../../lib/messages", async () => {
  const actual =
    await vi.importActual<typeof MessagesModule>("../../lib/messages")
  return {
    ...actual,
    sendNcMessage: sendNcMessageMock
  }
})

describe("useOptionsData", () => {
  beforeEach(() => {
    sendNcMessageMock.mockReset()
    const globalWithChrome = globalThis as typeof globalThis & {
      chrome: typeof chrome
    }
    globalWithChrome.chrome = {
      storage: {
        local: {
          getBytesInUse: vi.fn().mockResolvedValue(1024)
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    } as unknown as typeof chrome
  })

  it("状態再取得失敗時に既存 snapshot を空データへ置き換えないこと", async () => {
    const snapshot = createSnapshot()
    sendNcMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: snapshot
      } satisfies BackgroundResponse<OptionsSnapshot>)
      .mockResolvedValueOnce({
        ok: false,
        error: "storage unavailable"
      } satisfies BackgroundResponse<OptionsSnapshot>)

    const { result } = renderHook(() => useOptionsData())

    await waitFor(() => {
      expect(result.current.snapshot).toBe(snapshot)
    })

    await act(async () => {
      await result.current.refreshState(true)
    })

    expect(result.current.snapshot).toBe(snapshot)
    expect(result.current.error).toBe("storage unavailable")
  })

  it("状態再取得の通信失敗時にも既存 snapshot を維持すること", async () => {
    const snapshot = createSnapshot()
    sendNcMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: snapshot
      } satisfies BackgroundResponse<OptionsSnapshot>)
      .mockRejectedValueOnce(new Error("runtime disconnected"))

    const { result } = renderHook(() => useOptionsData())

    await waitFor(() => {
      expect(result.current.snapshot).toBe(snapshot)
    })

    await act(async () => {
      await result.current.refreshState(true)
    })

    expect(result.current.snapshot).toBe(snapshot)
    expect(result.current.error).toBe("runtime disconnected")
  })
})

function createSnapshot(): OptionsSnapshot {
  return {
    settings: DEFAULT_SETTINGS,
    state: DEFAULT_STATE,
    videos: {
      v1: {
        videoId: "v1",
        title: "video1",
        authorUrl: "author1",
        thumbnailUrls: [],
        capturedAt: 1
      }
    },
    authors: {
      author1: {
        authorUrl: "author1",
        name: "author1",
        capturedAt: 1
      }
    },
    events: DEFAULT_EVENTS_BUCKET,
    ratings: {},
    meta: DEFAULT_META,
    categories: DEFAULT_CATEGORIES
  }
}
