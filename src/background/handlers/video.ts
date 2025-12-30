import { produce } from "immer"

import { withStorageUpdates } from "../services/storage"
import { updateRecentWindow } from "../utils/recent-window"

export async function handleUpdateCurrentVideo(videoId: string) {
  await withStorageUpdates({
    keys: ["state", "settings", "videos"],
    context: "bg:video:updateCurrent",
    update: ({ state, settings, videos }) => {
      if (state.currentVideoId === videoId) {
        return { updates: {} }
      }

      const nextState = produce(state, (draft) => {
        if (state.currentVideoId && state.currentVideoId !== videoId) {
          draft.recentWindow = updateRecentWindow(
            draft.recentWindow,
            settings.recentWindowSize,
            [state.currentVideoId],
            videos
          )
        }
        draft.currentVideoId = videoId
      })

      return { updates: { state: nextState } }
    }
  })
}

export async function handleUpdatePinnedOpponent(videoId?: string) {
  await withStorageUpdates({
    keys: ["state", "videos"],
    context: "bg:video:updatePinned",
    update: ({ state, videos }) => {
      const nextPinned = videoId && videos[videoId] ? videoId : ""
      return {
        updates: {
          state: {
            ...state,
            pinnedOpponentVideoId: nextPinned
          }
        }
      }
    }
  })
}
