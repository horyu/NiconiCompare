import type { AuthorProfile, VideoSnapshot } from "../../lib/types"
import { getStorageData, setStorageData } from "../services/storage"

export async function handleRegisterSnapshot(payload: {
  video: VideoSnapshot
  author: AuthorProfile
}): Promise<void> {
  const { videos, authors } = await getStorageData(["videos", "authors"])

  await setStorageData({
    videos: {
      ...videos,
      [payload.video.videoId]: payload.video
    },
    authors: {
      ...authors,
      [payload.author.authorUrl]: payload.author
    }
  })
}
