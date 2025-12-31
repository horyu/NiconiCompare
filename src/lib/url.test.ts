import { describe, expect, it } from "vitest"

import { createWatchUrl, NICONICO_WATCH_BASE_URL } from "./url"

describe("createWatchUrl", () => {
  it("ベースURLと動画IDを結合すること", () => {
    expect(createWatchUrl("sm9")).toBe(`${NICONICO_WATCH_BASE_URL}/sm9`)
  })
})
