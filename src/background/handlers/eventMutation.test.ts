import { describe, expect, it } from "vitest"

import { DEFAULT_CATEGORY_ID, DEFAULT_SETTINGS } from "../../lib/constants"
import type { CompareEvent, NcEventsBucket } from "../../lib/types"
import { buildEventMutationUpdates } from "./eventMutation"

const buildEvent = (
  id: number,
  overrides: Partial<CompareEvent> = {}
): CompareEvent => ({
  id,
  timestamp: id,
  currentVideoId: `v${id}`,
  opponentVideoId: `v${id + 1}`,
  verdict: "better",
  disabled: false,
  categoryId: DEFAULT_CATEGORY_ID,
  ...overrides
})

describe("buildEventMutationUpdates", () => {
  it("events が未変更なら ratings を再構築しないこと", () => {
    const events: NcEventsBucket = {
      items: [buildEvent(1)],
      nextId: 2
    }

    const updates = buildEventMutationUpdates({
      currentEvents: events,
      nextEvents: events,
      settings: DEFAULT_SETTINGS,
      extraUpdates: {
        meta: {
          lastReplayEventId: 1,
          schemaVersion: "1.0.0",
          lastCleanupAt: 0
        }
      }
    })

    expect(updates).toEqual({
      meta: {
        lastReplayEventId: 1,
        schemaVersion: "1.0.0",
        lastCleanupAt: 0
      }
    })
  })

  it("events が変更されたら events と ratings をまとめて返すこと", () => {
    const currentEvents: NcEventsBucket = {
      items: [buildEvent(1), buildEvent(2)],
      nextId: 3
    }
    const nextEvents: NcEventsBucket = {
      ...currentEvents,
      items: [
        currentEvents.items[0],
        { ...currentEvents.items[1], disabled: true }
      ]
    }

    const updates = buildEventMutationUpdates({
      currentEvents,
      nextEvents,
      settings: DEFAULT_SETTINGS
    })

    expect(updates.events).toBe(nextEvents)
    expect(updates.ratings?.[DEFAULT_CATEGORY_ID]).toHaveProperty("v1")
    expect(updates.ratings?.[DEFAULT_CATEGORY_ID]).toHaveProperty("v2")
    expect(updates.ratings?.[DEFAULT_CATEGORY_ID]).not.toHaveProperty("v3")
  })
})
