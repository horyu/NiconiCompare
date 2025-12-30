import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useOpponentSelection } from "./useOpponentSelection"

describe("useOpponentSelection", () => {
  it("エラーなく実行され、有効な選択状態を返すこと", () => {
    const { result } = renderHook(() =>
      useOpponentSelection({
        currentVideoId: "video1",
        pinnedOpponentVideoId: "",
        recentWindow: ["video1", "video2", "video3"]
      })
    )

    // フックが有効な状態を返すことを検証
    expect(result.current.hasSelectableCandidates).toBe(true)
    expect(result.current.isPinned).toBe(false)
    expect(result.current.opponentVideoId).toBeDefined()
    expect(result.current.selectableWindow).toEqual(["video2", "video3"])
    expect(typeof result.current.setOpponentVideoId).toBe("function")
  })

  it("ピン留めされた対戦相手を選択すること", () => {
    const { result } = renderHook(() =>
      useOpponentSelection({
        currentVideoId: "video1",
        pinnedOpponentVideoId: "video3",
        recentWindow: ["video1", "video2", "video3"]
      })
    )

    expect(result.current.isPinned).toBe(true)
    expect(result.current.opponentVideoId).toBe("video3")
  })

  it("recentWindowに含まれないピン留めされた対戦相手を選択すること", () => {
    const { result } = renderHook(() =>
      useOpponentSelection({
        currentVideoId: "video1",
        pinnedOpponentVideoId: "video5",
        recentWindow: ["video1", "video2", "video3"]
      })
    )

    expect(result.current.isPinned).toBe(true)
    expect(result.current.opponentVideoId).toBe("video5")
    expect(result.current.selectableWindow).toEqual(["video2", "video3"])
  })

  it("ピン留めされた対戦相手の動画を開いた場合でもその動画を選択すること", () => {
    const { result, rerender } = renderHook(
      ({ currentVideoId, pinnedOpponentVideoId, recentWindow }) =>
        useOpponentSelection({
          currentVideoId,
          pinnedOpponentVideoId,
          recentWindow
        }),
      {
        initialProps: {
          currentVideoId: "video1",
          pinnedOpponentVideoId: "video2",
          recentWindow: ["video1", "video2", "video3"]
        }
      }
    )

    expect(result.current.isPinned).toBe(true)
    expect(result.current.opponentVideoId).toBe("video2")

    // ピン留めされた動画（video2）を開く
    rerender({
      currentVideoId: "video2",
      pinnedOpponentVideoId: "video2",
      recentWindow: ["video2", "video1", "video3"]
    })

    // ピン留めが優先されるため、video2が対戦相手として選択される
    expect(result.current.isPinned).toBe(true)
    expect(result.current.opponentVideoId).toBe("video2")
  })

  it("選択可能なウィンドウが空の場合を処理すること", () => {
    const { result } = renderHook(() =>
      useOpponentSelection({
        currentVideoId: "video1",
        pinnedOpponentVideoId: "",
        recentWindow: ["video1"]
      })
    )

    expect(result.current.hasSelectableCandidates).toBe(false)
    expect(result.current.opponentVideoId).toBeUndefined()
    expect(result.current.selectableWindow).toEqual([])
  })

  it("動画遷移時に直前の動画が選択可能なら対戦相手にすること", () => {
    const { result, rerender } = renderHook(
      ({ currentVideoId, recentWindow }) =>
        useOpponentSelection({
          currentVideoId,
          pinnedOpponentVideoId: "",
          recentWindow
        }),
      {
        initialProps: {
          currentVideoId: "video1",
          recentWindow: ["video1", "video2"]
        }
      }
    )

    const firstOpponent = result.current.opponentVideoId
    expect(firstOpponent).toBe("video2")

    // 現在の動画を変更
    rerender({
      currentVideoId: "video3",
      recentWindow: ["video1", "video2", "video3"]
    })

    // 直前の動画（video1）が対戦相手として選択される
    expect(result.current.opponentVideoId).toBe("video1")
    expect(result.current.selectableWindow).toEqual(["video1", "video2"])
  })

  it("リストの順序に関わらず直前の動画を優先的に選択すること", () => {
    const { result, rerender } = renderHook(
      ({ currentVideoId, recentWindow }) =>
        useOpponentSelection({
          currentVideoId,
          pinnedOpponentVideoId: "",
          recentWindow
        }),
      {
        initialProps: {
          currentVideoId: "video1",
          recentWindow: ["video1", "video2", "video3"]
        }
      }
    )

    // 初期状態：video2が選択される（選択可能ウィンドウの最初）
    expect(result.current.opponentVideoId).toBe("video2")
    expect(result.current.selectableWindow).toEqual(["video2", "video3"])

    // video4に変更し、recentWindowの先頭にvideo4が追加される
    rerender({
      currentVideoId: "video4",
      recentWindow: ["video4", "video2", "video3", "video1"]
    })

    // リストの最初（video2）ではなく、直前の動画（video1）が選択される
    expect(result.current.opponentVideoId).toBe("video1")
    expect(result.current.selectableWindow).toEqual([
      "video2",
      "video3",
      "video1"
    ])
  })

  it("選択中の対戦相手がrecentWindowから除外された場合に別の動画を選択すること", () => {
    const { result, rerender } = renderHook(
      ({ currentVideoId, recentWindow }) =>
        useOpponentSelection({
          currentVideoId,
          pinnedOpponentVideoId: "",
          recentWindow
        }),
      {
        initialProps: {
          currentVideoId: "video1",
          recentWindow: ["video1", "video2", "video3"]
        }
      }
    )

    // 初期状態：video2が選択されている
    expect(result.current.opponentVideoId).toBe("video2")

    // recentWindowからvideo2を除外
    rerender({
      currentVideoId: "video1",
      recentWindow: ["video1", "video3", "video4"]
    })

    // 新しい選択可能ウィンドウの最初（video3）が選択される
    expect(result.current.opponentVideoId).toBe("video3")
    expect(result.current.selectableWindow).toEqual(["video3", "video4"])
  })
})
