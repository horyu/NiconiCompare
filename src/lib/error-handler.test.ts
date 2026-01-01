import { describe, expect, it, vi } from "vitest"

import { handleBackgroundError, handleUIError, NcError } from "./error-handler"
import { logger } from "./logger"

vi.mock("./logger", () => ({
  logger: {
    error: vi.fn()
  }
}))

describe("handleBackgroundError", () => {
  it("ログにエラーを出力すること", () => {
    const error = new Error("boom")

    handleBackgroundError(error, "bg:test")

    expect(logger.error).toHaveBeenCalledWith("[bg:test]", error)
  })
})

describe("handleUIError", () => {
  it("showToast が未指定なら通知しないこと", () => {
    handleUIError(new Error("boom"), "ui:test")

    expect(logger.error).toHaveBeenCalledWith("[ui:test]", expect.any(Error))
  })

  it("userMessage 指定時は優先して通知すること", () => {
    const showToast = vi.fn()

    handleUIError(new Error("boom"), "ui:test", showToast, "fail")

    expect(showToast).toHaveBeenCalledWith("error", "fail")
  })

  it("NcError の userMessage を通知すること", () => {
    const showToast = vi.fn()

    handleUIError(
      new NcError("boom", "ui:test", "detail"),
      "ui:test",
      showToast
    )

    expect(showToast).toHaveBeenCalledWith("error", "detail")
  })

  it("未知のエラーは既定メッセージで通知すること", () => {
    const showToast = vi.fn()

    handleUIError(new Error("boom"), "ui:test", showToast)

    expect(showToast).toHaveBeenCalledWith(
      "error",
      "予期しないエラーが発生しました。"
    )
  })
})
