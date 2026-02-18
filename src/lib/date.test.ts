import { describe, expect, it } from "vitest"

import { formatCompactTimestamp, formatPaddedDateTime } from "./date"

describe("formatCompactTimestamp", () => {
  it("ゼロ埋めされた YYYYMMDDHHmmss 形式を返すこと", () => {
    const date = new Date(2026, 0, 2, 3, 4, 5)
    expect(formatCompactTimestamp(date)).toBe("20260102030405")
  })
})

describe("formatPaddedDateTime", () => {
  it("ゼロ埋めされた YYYY/MM/DD HH:mm:ss 形式を返すこと", () => {
    const date = new Date(2026, 0, 2, 3, 4, 5)
    expect(formatPaddedDateTime(date)).toBe("2026/01/02 03:04:05")
  })
})
