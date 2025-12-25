import { produce } from "immer"

import { getStorageData, setStorageData } from "./storage"

const RETRY_DELAYS = [1000, 3000, 5000]

export async function markEventPersistent(eventId: number) {
  const { events } = await getStorageData(["events"])
  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return true
  }
  if (events.items[index].persistent) {
    return true
  }

  const updatedEvents = produce(events, (draft) => {
    draft.items[index] = { ...draft.items[index], persistent: true }
  })
  await setStorageData({ events: updatedEvents })
  return true
}

export async function queueEventRetry(eventId: number) {
  const { meta } = await getStorageData(["meta"])
  if (meta.retryQueue.some((entry) => entry.eventId === eventId)) {
    return
  }

  const updatedMeta = produce(meta, (draft) => {
    draft.retryQueue.push({
      eventId,
      retryCount: 0,
      lastAttempt: Date.now()
    })
  })
  await setStorageData({ meta: updatedMeta })
}

export async function removeRetryEntry(eventId: number) {
  const { meta } = await getStorageData(["meta"])
  const nextQueue = meta.retryQueue.filter((entry) => entry.eventId !== eventId)
  const nextFailed = meta.failedWrites.filter((id) => id !== eventId)
  if (
    nextQueue.length === meta.retryQueue.length &&
    nextFailed.length === meta.failedWrites.length
  ) {
    return
  }
  await setStorageData({
    meta: {
      ...meta,
      retryQueue: nextQueue,
      failedWrites: nextFailed
    }
  })
}

export async function processRetryQueue() {
  const { meta } = await getStorageData(["meta"])
  const queue = [...meta.retryQueue]
  const remaining = []
  const failedWrites = new Set(meta.failedWrites)
  const now = Date.now()

  for (const entry of queue) {
    const delay =
      RETRY_DELAYS[Math.min(entry.retryCount, RETRY_DELAYS.length - 1)]
    if (now - entry.lastAttempt < delay) {
      remaining.push(entry)
      continue
    }
    try {
      const success = await markEventPersistent(entry.eventId)
      if (!success) {
        throw new Error("markEventPersistent returned false")
      }
      await removeRetryEntry(entry.eventId)
    } catch (error) {
      console.error("Retry failed", error)
      if (entry.retryCount + 1 >= RETRY_DELAYS.length) {
        failedWrites.add(entry.eventId)
      } else {
        remaining.push({
          ...entry,
          retryCount: entry.retryCount + 1,
          lastAttempt: now
        })
      }
    }
  }

  const updatedMeta = produce(meta, (draft) => {
    draft.retryQueue = remaining
    draft.failedWrites = Array.from(failedWrites)
  })
  await setStorageData({ meta: updatedMeta })
}
