import { describe, expect, expectTypeOf, it, vi } from "vitest"

import { MESSAGE_TYPES } from "./constants"
import { sendNcMessage, type MessageResponse } from "./messages"

describe("sendNcMessage", () => {
  it("chrome.runtime.sendMessage を呼び出して結果を返すこと", async () => {
    const response = { ok: true, data: { id: 1 } }
    const sendMessage = vi.fn().mockResolvedValue(response)
    const globalAny = globalThis as unknown as {
      chrome: { runtime: { sendMessage: typeof sendMessage } }
    }
    globalAny.chrome = { runtime: { sendMessage } }

    const result = await sendNcMessage({
      type: MESSAGE_TYPES.requestState
    })

    expect(sendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.requestState
    })
    expect(result).toEqual(response)
  })

  it("chrome.runtime.sendMessage がエラーを投げた場合に例外が伝播すること", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new Error("Connection failed"))
    const windowWithChrome = globalThis as typeof globalThis & {
      chrome: typeof chrome
    }
    windowWithChrome.chrome = {
      runtime: { sendMessage }
    } as unknown as typeof chrome

    await expect(
      sendNcMessage({ type: MESSAGE_TYPES.requestState })
    ).rejects.toThrow("Connection failed")
  })

  it("メッセージごとのレスポンス型を引数から推論すること", () => {
    const recordEventMessage = {
      type: MESSAGE_TYPES.recordEvent,
      payload: {
        currentVideoId: "sm1",
        opponentVideoId: "sm2",
        verdict: "better"
      }
    } as const
    const requestStateMessage = {
      type: MESSAGE_TYPES.requestState
    } as const
    const updateSettingsMessage = {
      type: MESSAGE_TYPES.updateSettings,
      payload: { overlayAndCaptureEnabled: true }
    } as const

    type RecordEventResponse = MessageResponse<typeof recordEventMessage>
    type RequestStateResponse = MessageResponse<typeof requestStateMessage>
    type UpdateSettingsResponse = MessageResponse<typeof updateSettingsMessage>

    expectTypeOf<Extract<RecordEventResponse, { ok: true }>>().toEqualTypeOf<{
      ok: true
      eventId: number
    }>()
    expectTypeOf<
      Extract<RequestStateResponse, { ok: true }>["data"]
    >().toHaveProperty("settings")
    expectTypeOf<
      Extract<UpdateSettingsResponse, { ok: true }>
    >().toEqualTypeOf<{
      ok: true
    }>()
    expectTypeOf<
      Extract<UpdateSettingsResponse, { ok: true }>
    >().not.toHaveProperty("eventId")
  })
})
