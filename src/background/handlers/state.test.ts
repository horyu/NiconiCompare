import { beforeEach, describe, expect, it, vi } from "vitest"

import { readStateSnapshot } from "./state"

const { withStorageUpdatesMock } = vi.hoisted(() => ({
  withStorageUpdatesMock: vi.fn()
}))

vi.mock("../services/storage", () => ({
  withStorageUpdates: withStorageUpdatesMock
}))

describe("readStateSnapshot", () => {
  beforeEach(() => {
    withStorageUpdatesMock.mockReset()
  })

  it("Storage 読み取り失敗時に空 snapshot へ fallback せず失敗させること", async () => {
    withStorageUpdatesMock.mockRejectedValue(new Error("storage unavailable"))

    await expect(readStateSnapshot()).rejects.toThrow("storage unavailable")
  })
})
