import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildDelimitedText, buildExportFilename } from "./export"

describe("buildDelimitedText", () => {
  it("区切り文字・改行・引用符を適切にエスケープすること", () => {
    const text = buildDelimitedText({
      header: ["a", "b"],
      rows: [
        ["1", "2"],
        ["x,y", 'a"b'],
        ["line\nbreak", "ok"]
      ],
      delimiter: ","
    })

    expect(text).toBe(
      ["a,b", "1,2", '"x,y","a""b"', '"line\nbreak",ok'].join("\n")
    )
  })
})

describe("buildExportFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 2, 3, 4, 5))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("カテゴリ名が未指定の場合はプレフィックスのみで生成すること", () => {
    expect(buildExportFilename("Niconi", "csv")).toBe(
      "Niconi-20240102030405.csv"
    )
  })

  it("カテゴリ名の禁止文字を取り除くこと", () => {
    expect(buildExportFilename("Niconi", "tsv", 'a/b:c*?"<>|')).toBe(
      "Niconi-abc-20240102030405.tsv"
    )
  })
})
