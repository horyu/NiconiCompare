import { produce } from "immer"

import type { NcEventsBucket } from "../../lib/types"
import { withStorageUpdates } from "../services/storage"
import { buildEventMutationUpdates } from "./eventMutation"

export async function handleDeleteEvent(eventId: number): Promise<boolean> {
  const result = await withStorageUpdates({
    keys: ["events", "settings", "meta"],
    context: "bg:events:delete",
    update: ({ events, settings, meta }) => {
      const index = events.items.findIndex((event) => event.id === eventId)
      if (index === -1) {
        return { updates: {}, result: false }
      }

      const event = events.items[index]
      if (!event) {
        return { updates: {}, result: false }
      }
      if (event.disabled) {
        return { updates: {}, result: true }
      }

      const updatedEvents = produce(events, (draft) => {
        const target = draft.items[index]
        if (target) {
          draft.items[index] = { ...target, disabled: true }
        }
      })

      return {
        updates: buildEventMutationUpdates({
          currentEvents: events,
          nextEvents: updatedEvents,
          settings,
          extraUpdates: { meta }
        }),
        result: true
      }
    }
  })

  return result ?? false
}

export async function handleRestoreEvent(eventId: number): Promise<boolean> {
  const result = await withStorageUpdates({
    keys: ["events", "settings"],
    context: "bg:events:restore",
    update: ({ events, settings }) => {
      const index = events.items.findIndex((event) => event.id === eventId)
      if (index === -1) {
        return { updates: {}, result: false }
      }

      const event = events.items[index]
      if (!event) {
        return { updates: {}, result: false }
      }
      if (!event.disabled) {
        return { updates: {}, result: true }
      }

      const updatedEvents = produce(events, (draft) => {
        const target = draft.items[index]
        if (target) {
          draft.items[index] = { ...target, disabled: false }
        }
      })

      return {
        updates: buildEventMutationUpdates({
          currentEvents: events,
          nextEvents: updatedEvents,
          settings
        }),
        result: true
      }
    }
  })

  return result ?? false
}

export async function handlePurgeEvent(eventId: number): Promise<boolean> {
  const result = await withStorageUpdates({
    keys: ["events", "settings", "meta"],
    context: "bg:events:purge",
    update: ({ events, settings, meta }) => {
      const index = events.items.findIndex((event) => event.id === eventId)
      if (index === -1) {
        return { updates: {}, result: false }
      }

      const event = events.items[index]
      if (!event || !event.disabled) {
        return { updates: {}, result: false }
      }

      const updatedEvents: NcEventsBucket = {
        items: events.items.filter((item) => item.id !== eventId),
        nextId: events.nextId
      }

      return {
        updates: buildEventMutationUpdates({
          currentEvents: events,
          nextEvents: updatedEvents,
          settings,
          extraUpdates: { meta }
        }),
        result: true
      }
    }
  })

  return result ?? false
}
