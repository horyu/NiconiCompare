import { produce } from "immer"

import { getStorageData, setStorageData } from "../services/storage"
import { updateRecentWindow } from "../utils/recent-window"

export async function handleUpdateCurrentVideo(videoId: string) {
  const { state, settings, videos } = await getStorageData([
    "state",
    "settings",
    "videos"
  ])

  if (state.currentVideoId === videoId) {
    return
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

  await setStorageData({ state: nextState })
}

export async function handleUpdatePinnedOpponent(videoId?: string) {
  const { state, videos } = await getStorageData(["state", "videos"])
  const nextPinned = videoId && videos[videoId] ? videoId : undefined

  await setStorageData({
    state: {
      ...state,
      pinnedOpponentVideoId: nextPinned
    }
  })
}
