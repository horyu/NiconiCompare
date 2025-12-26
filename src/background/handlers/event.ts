import { produce } from "immer"

import { handleBackgroundError } from "../../lib/error-handler"
import { updatePairRatings } from "../../lib/glicko"
import type {
  CompareEvent,
  NcEventsBucket,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos,
  Verdict
} from "../../lib/types"
import { getStorageData, setStorageData } from "../services/storage"
import {
  getOrCreateRatingSnapshot,
  rebuildRatingsFromEvents
} from "../utils/rating-helpers"

type RecordEventPayload = {
  currentVideoId: string
  opponentVideoId: string
  verdict: Verdict
  eventId?: number
}

export async function handleRecordEvent(payload: RecordEventPayload) {
  const { events, state, settings, ratings, videos } = await getStorageData([
    "events",
    "state",
    "settings",
    "ratings",
    "videos"
  ])

  const targetEvent = findTargetEvent(events, payload)
  if (targetEvent && isSamePairEvent(targetEvent, payload)) {
    const updatedEvents = updateEventVerdict(
      events,
      targetEvent.id,
      payload.verdict
    )
    const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)
    return persistEventChanges(targetEvent.id, {
      events: updatedEvents,
      ratings: nextRatings
    })
  }

  const eventId = events.nextId
  const newEvent = buildNewEvent(eventId, payload)
  const updatedEvents = appendEvent(events, newEvent)
  const nextRatings = updateRatingsForNewEvent(
    ratings,
    payload,
    settings,
    eventId
  )
  const updatedState = updateStateForNewEvent(state, settings, payload, videos)

  return persistEventChanges(eventId, {
    events: updatedEvents,
    state: updatedState,
    ratings: nextRatings
  })
}

function findTargetEvent(
  events: NcEventsBucket,
  payload: RecordEventPayload
): CompareEvent | undefined {
  if (!payload.eventId) {
    return undefined
  }

  return events.items.find(
    (event) => event.id === payload.eventId && !event.disabled
  )
}

function isSamePairEvent(
  event: CompareEvent,
  payload: RecordEventPayload
): boolean {
  return (
    (event.currentVideoId === payload.currentVideoId &&
      event.opponentVideoId === payload.opponentVideoId) ||
    (event.currentVideoId === payload.opponentVideoId &&
      event.opponentVideoId === payload.currentVideoId)
  )
}

function updateEventVerdict(
  events: NcEventsBucket,
  eventId: number,
  verdict: Verdict
): NcEventsBucket {
  return produce(events, (draft) => {
    const index = draft.items.findIndex((event) => event.id === eventId)
    if (index !== -1) {
      draft.items[index] = {
        ...draft.items[index],
        verdict,
        timestamp: Date.now()
      }
    }
  })
}

function buildNewEvent(
  eventId: number,
  payload: RecordEventPayload
): CompareEvent {
  return {
    id: eventId,
    timestamp: Date.now(),
    currentVideoId: payload.currentVideoId,
    opponentVideoId: payload.opponentVideoId,
    verdict: payload.verdict,
    disabled: false
  }
}

function appendEvent(
  events: NcEventsBucket,
  newEvent: CompareEvent
): NcEventsBucket {
  return {
    items: [...events.items, newEvent],
    nextId: newEvent.id + 1
  }
}

function updateRatingsForNewEvent(
  ratings: NcRatings,
  payload: RecordEventPayload,
  settings: NcSettings,
  eventId: number
): NcRatings {
  const leftRating = getOrCreateRatingSnapshot(
    ratings,
    payload.currentVideoId,
    settings
  )
  const rightRating = getOrCreateRatingSnapshot(
    ratings,
    payload.opponentVideoId,
    settings
  )

  return produce(ratings, (draft) => {
    const { left, right } = updatePairRatings({
      settings,
      left: leftRating,
      right: rightRating,
      verdict: payload.verdict,
      eventId
    })
    draft[left.videoId] = left
    draft[right.videoId] = right
  })
}

function updateStateForNewEvent(
  state: NcState,
  settings: NcSettings,
  payload: RecordEventPayload,
  videos: NcVideos
): NcState {
  return produce(state, (draft) => {
    draft.recentWindow = buildRecentWindow(
      draft.recentWindow,
      settings.recentWindowSize,
      payload.currentVideoId,
      payload.opponentVideoId,
      videos
    )
  })
}

async function persistEventChanges(
  eventId: number,
  updates: Partial<{
    events: NcEventsBucket
    state: NcState
    ratings: NcRatings
  }>
): Promise<number> {
  try {
    await setStorageData(updates)
    return eventId
  } catch (error) {
    handleBackgroundError(error, "handleRecordEvent.persistEventChanges")
    throw error
  }
}

function buildRecentWindow(
  current: string[],
  size: number,
  currentVideoId: string,
  opponentVideoId: string,
  videos: NcVideos
) {
  const hasVideo = (id: string) => !!(id && videos[id])
  const deduped = current.filter(
    (id) => id !== currentVideoId && id !== opponentVideoId && hasVideo(id)
  )
  const next = [currentVideoId, opponentVideoId, ...deduped].filter(hasVideo)
  return next.slice(0, Math.max(1, size))
}
