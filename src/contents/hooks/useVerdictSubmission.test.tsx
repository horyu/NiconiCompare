import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BackgroundResponse } from "../../lib/messages"
import type { Verdict } from "../../lib/types"
import { useVerdictSubmission } from "./useVerdictSubmission"

interface SubmissionMessage {
  payload?: {
    eventId?: number
  }
}

const { runNcActionMock, sendNcMessageMock } = vi.hoisted(() => ({
  runNcActionMock: vi.fn(),
  sendNcMessageMock: vi.fn<
    (message: SubmissionMessage) => Promise<BackgroundResponse>
  >()
}))

vi.mock("../../lib/messages", () => ({
  sendNcMessage: sendNcMessageMock
}))

vi.mock("../../lib/ncAction", () => ({
  runNcAction: runNcActionMock
}))

describe("useVerdictSubmission", () => {
  beforeEach(() => {
    runNcActionMock.mockReset()
    sendNcMessageMock.mockReset()
  })

  it("カテゴリ切替時に lastVerdict / lastEventId をリセットすること", async () => {
    sendNcMessageMock.mockResolvedValue({ ok: true, eventId: 101 })
    runNcActionMock.mockImplementation(
      (
        action: () => Promise<BackgroundResponse>,
        _options: unknown
      ) => action()
    )
    const refreshState = vi.fn(async () => {})

    const { result, rerender } = renderHook(
      ({ activeCategoryId, currentVideoId, opponentVideoId }) =>
        useVerdictSubmission({
          activeCategoryId,
          currentVideoId,
          opponentVideoId,
          refreshState
        }),
      {
        initialProps: {
          activeCategoryId: "cat-a",
          currentVideoId: "video-1",
          opponentVideoId: "video-2"
        }
      }
    )

    await act(async () => {
      await result.current.submitVerdict("better" as Verdict)
    })

    await waitFor(() => {
      expect(result.current.lastVerdict).toBe("better")
      expect(result.current.lastEventId).toBe(101)
    })

    rerender({
      activeCategoryId: "cat-b",
      currentVideoId: "video-1",
      opponentVideoId: "video-2"
    })

    await waitFor(() => {
      expect(result.current.lastVerdict).toBeUndefined()
      expect(result.current.lastEventId).toBeUndefined()
    })
  })

  it("カテゴリ切替後の再送信では前回 eventId を引き継がないこと", async () => {
    sendNcMessageMock
      .mockResolvedValueOnce({ ok: true, eventId: 201 })
      .mockResolvedValueOnce({ ok: true, eventId: 202 })
    runNcActionMock.mockImplementation(
      (
        action: () => Promise<BackgroundResponse>,
        _options: unknown
      ) => action()
    )
    const refreshState = vi.fn(async () => {})

    const { result, rerender } = renderHook(
      ({ activeCategoryId }) =>
        useVerdictSubmission({
          activeCategoryId,
          currentVideoId: "video-1",
          opponentVideoId: "video-2",
          refreshState
        }),
      {
        initialProps: { activeCategoryId: "cat-a" }
      }
    )

    await act(async () => {
      await result.current.submitVerdict("better" as Verdict)
    })

    rerender({ activeCategoryId: "cat-b" })

    await act(async () => {
      await result.current.submitVerdict("same" as Verdict)
    })

    expect(sendNcMessageMock.mock.calls[0]?.[0]?.payload?.eventId).toBeUndefined()
    expect(sendNcMessageMock.mock.calls[1]?.[0]?.payload?.eventId).toBeUndefined()
  })
})
