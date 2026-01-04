import { produce } from "immer"

import { DEFAULT_CATEGORY_ID } from "../../lib/constants"
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
import { withStorageUpdates } from "../services/storage"
import {
  getOrCreateRatingSnapshot,
  rebuildRatingsFromEvents
} from "../utils/ratingHelpers"
import { updateRecentWindow } from "../utils/recentWindow"

interface RecordEventPayload {
  currentVideoId: string
  opponentVideoId: string
  verdict: Verdict
  eventId?: number
}

export async function handleRecordEvent(payload: RecordEventPayload) {
  const result = await withStorageUpdates({
    keys: ["events", "state", "settings", "ratings", "videos"],
    context: "bg:events:record",
    update: ({ events, state, settings, ratings, videos }) => {
      const targetEvent = findTargetEvent(events, payload)
      if (targetEvent && isSamePairEvent(targetEvent, payload)) {
        const updatedEvents = updateEventVerdict(
          events,
          targetEvent.id,
          payload.verdict
        )
        const nextRatings = rebuildRatingsFromEvents(
          updatedEvents.items,
          settings
        )
        return {
          updates: {
            events: updatedEvents,
            ratings: nextRatings
          },
          result: targetEvent.id
        }
      }

      const eventId = events.nextId
      const activeCategoryId = settings.activeCategoryId ?? DEFAULT_CATEGORY_ID
      const newEvent = buildNewEvent(eventId, payload, activeCategoryId)
      const updatedEvents = appendEvent(events, newEvent)
      const nextRatings = updateRatingsForNewEvent(
        ratings,
        payload,
        settings,
        eventId,
        activeCategoryId
      )
      const updatedState = updateStateForNewEvent(
        state,
        settings,
        payload,
        videos
      )

      return {
        updates: {
          events: updatedEvents,
          state: updatedState,
          ratings: nextRatings
        },
        result: eventId
      }
    }
  })

  return result
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
  payload: RecordEventPayload,
  categoryId: string
): CompareEvent {
  return {
    id: eventId,
    timestamp: Date.now(),
    currentVideoId: payload.currentVideoId,
    opponentVideoId: payload.opponentVideoId,
    verdict: payload.verdict,
    disabled: false,
    categoryId
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
  eventId: number,
  categoryId: string
): NcRatings {
  const categoryRatings = ratings[categoryId] ?? {}
  const leftRating = getOrCreateRatingSnapshot(
    categoryRatings,
    payload.currentVideoId,
    settings
  )
  const rightRating = getOrCreateRatingSnapshot(
    categoryRatings,
    payload.opponentVideoId,
    settings
  )

  return produce(ratings, (draft) => {
    if (!draft[categoryId]) {
      draft[categoryId] = {}
    }
    const draftCategory = draft[categoryId]
    const { left, right } = updatePairRatings({
      settings,
      left: leftRating,
      right: rightRating,
      verdict: payload.verdict,
      eventId
    })
    draftCategory[left.videoId] = left
    draftCategory[right.videoId] = right
  })
}

function updateStateForNewEvent(
  state: NcState,
  settings: NcSettings,
  payload: RecordEventPayload,
  videos: NcVideos
): NcState {
  return produce(state, (draft) => {
    draft.recentWindow = updateRecentWindow(
      draft.recentWindow,
      settings.recentWindowSize,
      [payload.currentVideoId, payload.opponentVideoId],
      videos
    )
  })
}
