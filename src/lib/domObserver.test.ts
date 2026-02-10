import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OVERLAY_STATUS_MESSAGES } from "./constants"
import type { VideoData } from "./domObserver"
import { extractVideoDataFromLdJson, observeLdJsonChanges } from "./domObserver"

const setLdJson = (payload: unknown): void => {
  const script = document.createElement("script")
  script.type = "application/ld+json"
  script.textContent = JSON.stringify(payload)
  document.head.append(script)
}

describe("extractVideoDataFromLdJson", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
  })

  it("JSON-LD が存在しない場合は undefined を返す", () => {
    expect(extractVideoDataFromLdJson()).toBeUndefined()
  })

  it("VideoObject の JSON-LD から video と author を抽出する", () => {
    setLdJson({
      "@type": "VideoObject",
      identifier: "sm1234567",
      name: "Test Video",
      url: "https://www.nicovideo.jp/watch/sm1234567",
      thumbnailUrl: ["https://example.com/thumb.jpg"],
      author: {
        name: "Author Name",
        url: "https://www.nicovideo.jp/user/1"
      }
    })

    const data = extractVideoDataFromLdJson()
    expect(data?.video.videoId).toBe("sm1234567")
    expect(data?.video.title).toBe("Test Video")
    expect(data?.video.thumbnailUrls).toEqual(["https://example.com/thumb.jpg"])
    expect(data?.author.authorUrl).toBe("https://www.nicovideo.jp/user/1")
    expect(data?.author.name).toBe("Author Name")
  })

  it("JSON-LD 配列内の VideoObject を抽出する", () => {
    setLdJson([
      { "@type": "BreadcrumbList" },
      {
        "@type": "VideoObject",
        videoId: "sm2222222",
        name: "Array Video",
        author: { name: "Array Author" }
      }
    ])

    const data = extractVideoDataFromLdJson()
    expect(data?.video.videoId).toBe("sm2222222")
    expect(data?.author.name).toBe("Array Author")
  })
})

describe("observeLdJsonChanges", () => {
  const originalIdleCallback = window.requestIdleCallback

  beforeEach(() => {
    document.head.innerHTML = ""
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: ((callback: () => void): number => {
        callback()
        return 1
      }) as typeof window.requestIdleCallback
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: originalIdleCallback
    })
  })

  it("JSON-LD 追加時に onVideoDataChange を呼び出す", async () => {
    const onVideoDataChange = vi.fn<(data: VideoData) => void>()
    const onError = vi.fn()
    const cleanup = observeLdJsonChanges({ onVideoDataChange, onError })

    setLdJson({
      "@type": "VideoObject",
      identifier: "sm3333333",
      name: "Observed Video",
      author: { name: "Observer Author" }
    })

    await vi.waitFor(() => {
      expect(onVideoDataChange).toHaveBeenCalled()
    })

    expect(onVideoDataChange).toHaveBeenCalledTimes(1)
    const [payload] = onVideoDataChange.mock.calls[0] ?? []
    expect(payload?.video.videoId).toBe("sm3333333")
    cleanup?.()
  })

  it("JSON-LD が連続で変わる場合は都度 onVideoDataChange を呼び出す", async () => {
    const onVideoDataChange = vi.fn<(data: VideoData) => void>()
    const onError = vi.fn()
    const cleanup = observeLdJsonChanges({ onVideoDataChange, onError })

    setLdJson({
      "@type": "VideoObject",
      identifier: "sm4444444",
      name: "Observed Video 1",
      author: { name: "Observer Author 1" }
    })

    await vi.waitFor(() => {
      expect(onVideoDataChange).toHaveBeenCalled()
    })

    document.head.innerHTML = ""
    setLdJson({
      "@type": "VideoObject",
      identifier: "sm5555555",
      name: "Observed Video 2",
      author: { name: "Observer Author 2" }
    })

    await vi.waitFor(() => {
      expect(onVideoDataChange).toHaveBeenCalledTimes(2)
    })

    expect(onVideoDataChange).toHaveBeenCalledTimes(2)
    const firstCall = onVideoDataChange.mock.calls[0]?.[0]
    const secondCall = onVideoDataChange.mock.calls[1]?.[0]
    expect(firstCall?.video.videoId).toBe("sm4444444")
    expect(secondCall?.video.videoId).toBe("sm5555555")
    cleanup?.()
  })

  it("document.head が存在しない場合は undefined を返し、onError を呼び出す", () => {
    const originalHead = document.head
    const onVideoDataChange = vi.fn<(data: VideoData) => void>()
    const onError = vi.fn()

    try {
      // document.head を一時的に削除
      Object.defineProperty(document, "head", {
        configurable: true,
        writable: true,
        value: undefined
      })

      const cleanup = observeLdJsonChanges({ onVideoDataChange, onError })

      expect(cleanup).toBeUndefined()
      expect(onError).toHaveBeenCalledWith(
        OVERLAY_STATUS_MESSAGES.jsonLdUnavailable
      )
    } finally {
      // 元に戻す
      Object.defineProperty(document, "head", {
        configurable: true,
        writable: true,
        value: originalHead
      })
    }
  })

  it("cleanup を呼び出すと MutationObserver が停止する", async () => {
    const onVideoDataChange = vi.fn<(data: VideoData) => void>()
    const onError = vi.fn()
    const cleanup = observeLdJsonChanges({ onVideoDataChange, onError })

    setLdJson({
      "@type": "VideoObject",
      identifier: "sm6666666",
      name: "Before Cleanup",
      author: { name: "Author" }
    })

    await vi.waitFor(() => {
      expect(onVideoDataChange).toHaveBeenCalled()
    })

    expect(onVideoDataChange).toHaveBeenCalledTimes(1)

    // cleanup を呼び出す
    cleanup?.()

    // cleanup 後に JSON-LD を追加
    document.head.innerHTML = ""
    setLdJson({
      "@type": "VideoObject",
      identifier: "sm7777777",
      name: "After Cleanup",
      author: { name: "Author" }
    })

    // cleanup 後は呼び出されない
    await vi.waitFor(() => {
      expect(onVideoDataChange).toHaveBeenCalledTimes(1)
    })
  })

  it("requestIdleCallback が存在しない環境では setTimeout を使用する", async () => {
    const onVideoDataChange = vi.fn<(data: VideoData) => void>()
    const onError = vi.fn()

    // requestIdleCallback を削除して setTimeout にフォールバックさせる
    const originalIdleCallback = window.requestIdleCallback
    try {
      // @ts-expect-error - テストのために削除
      delete window.requestIdleCallback

      const cleanup = observeLdJsonChanges({ onVideoDataChange, onError })

      setLdJson({
        "@type": "VideoObject",
        identifier: "sm8888888",
        name: "Fallback Video",
        author: { name: "Fallback Author" }
      })

      await vi.waitFor(() => {
        expect(onVideoDataChange).toHaveBeenCalledTimes(1)
      })

      const [payload] = onVideoDataChange.mock.calls[0] ?? []
      expect(payload?.video.videoId).toBe("sm8888888")
      cleanup?.()
    } finally {
      // 元に戻す
      window.requestIdleCallback = originalIdleCallback
    }
  })
})
