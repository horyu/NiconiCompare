import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readSessionState } from "./sessionStorage"

const FALLBACK = { page: 1 }

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

describe("readSessionState", () => {
  it("不正な JSON は fallback を返すこと", () => {
    sessionStorage.setItem("test", "{")

    expect(readSessionState("test", FALLBACK, normalizePage)).toBe(FALLBACK)
  })

  it("復元値を normalizer に渡すこと", () => {
    sessionStorage.setItem("test", JSON.stringify({ page: "2" }))

    expect(readSessionState("test", FALLBACK, normalizePage)).toEqual({
      page: 1
    })
  })
})

function normalizePage(value: unknown): { page: number } {
  if (
    typeof value === "object" &&
    value !== null &&
    "page" in value &&
    typeof value.page === "number"
  ) {
    return { page: value.page }
  }
  return FALLBACK
}
