import { produce } from "immer"

import type { NcVideos } from "../../lib/types"
import { getStorageData, setStorageData } from "../services/storage"

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
      draft.recentWindow = insertVideoIntoRecentWindow(
        draft.recentWindow,
        settings.recentWindowSize,
        state.currentVideoId,
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

function insertVideoIntoRecentWindow(
  current: string[],
  size: number,
  videoId: string,
  videos: NcVideos
) {
  const filtered = current.filter((id) => videos[id])
  if (!videoId || !videos[videoId]) {
    return filtered
  }
  const deduped = filtered.filter((id) => id !== videoId)
  return [videoId, ...deduped].slice(0, Math.max(1, size))
}
