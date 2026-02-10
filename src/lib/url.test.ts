import { describe, expect, it } from "vitest"

import {
  createWatchUrl,
  getWatchVideoIdFromPathname,
  NICONICO_WATCH_BASE_URL
} from "./url"

describe("createWatchUrl", () => {
  it("ベースURLと動画IDを結合すること", () => {
    expect(createWatchUrl("sm9")).toBe(`${NICONICO_WATCH_BASE_URL}/sm9`)
  })
})

describe("getWatchVideoIdFromPathname", () => {
  it("watch ページのパスから動画IDを取得すること", () => {
    expect(getWatchVideoIdFromPathname("/watch/sm9")).toBe("sm9")
  })

  it("watch 以外のパスは undefined を返すこと", () => {
    expect(getWatchVideoIdFromPathname("/search/sm9")).toBeUndefined()
  })
})
