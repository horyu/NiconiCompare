import { describe, expect, it, vi } from "vitest"

import { MESSAGE_TYPES } from "./constants"
import { sendNcMessage } from "./messages"

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
})
