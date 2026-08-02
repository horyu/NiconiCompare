import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MESSAGE_TYPES } from "../../lib/constants"
import type { CompareEvent } from "../../lib/types"
import { useEventActions } from "./useEventActions"

const { runNcActionMock, sendNcMessageMock } = vi.hoisted(() => ({
  runNcActionMock: vi.fn(),
  sendNcMessageMock: vi.fn()
}))

vi.mock("../../lib/messages", () => ({
  sendNcMessage: sendNcMessageMock
}))

vi.mock("../../lib/ncAction", () => ({
  runNcAction: runNcActionMock
}))

const event: CompareEvent = {
  id: 1,
  timestamp: 1,
  currentVideoId: "video-1",
  opponentVideoId: "video-2",
  verdict: "better",
  disabled: false,
  categoryId: "category-1"
}

describe("useEventActions", () => {
  beforeEach(() => {
    runNcActionMock.mockReset()
    sendNcMessageMock.mockReset()
  })

  it("評価変更を対応するメッセージとして送信すること", async () => {
    const refreshState = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()
    sendNcMessageMock.mockResolvedValue({ ok: true, eventId: event.id })
    runNcActionMock.mockImplementation((action: () => Promise<unknown>) =>
      action()
    )
    const { result } = renderHook(() =>
      useEventActions({ refreshState, showToast })
    )

    await act(async () => {
      await result.current.handleEventVerdictChange(event, "same")
    })

    expect(sendNcMessageMock).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.recordEvent,
      payload: {
        currentVideoId: event.currentVideoId,
        opponentVideoId: event.opponentVideoId,
        verdict: "same",
        eventId: event.id
      }
    })
    expect(runNcActionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ context: "ui:options:events:update" })
    )
  })

  it("個別操作の実行中だけ対象イベントを busy にすること", async () => {
    let completeAction: (() => void) | undefined
    runNcActionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeAction = resolve
        })
    )
    const { result } = renderHook(() =>
      useEventActions({
        refreshState: vi.fn().mockResolvedValue(undefined),
        showToast: vi.fn()
      })
    )

    let pendingAction: Promise<void> | undefined
    act(() => {
      pendingAction = result.current.handleDeleteEvent(event.id)
    })

    expect(result.current.eventBusyId).toBe(event.id)

    await act(async () => {
      completeAction?.()
      await pendingAction
    })

    expect(result.current.eventBusyId).toBeNull()
  })

  it("操作が失敗しても busy 状態を解除すること", async () => {
    runNcActionMock.mockRejectedValue(new Error("request failed"))
    const { result } = renderHook(() =>
      useEventActions({
        refreshState: vi.fn().mockResolvedValue(undefined),
        showToast: vi.fn()
      })
    )

    await act(async () => {
      await expect(result.current.handleRestoreEvent(event.id)).rejects.toThrow(
        "request failed"
      )
    })

    expect(result.current.eventBusyId).toBeNull()
  })
})
