import type { AuthorProfile, VideoSnapshot } from "../../lib/types"
import { withStorageUpdates } from "../services/storage"

export async function handleRegisterSnapshot(payload: {
  video: VideoSnapshot
  author: AuthorProfile
}): Promise<void> {
  await withStorageUpdates({
    keys: ["videos", "authors"],
    context: "bg:snapshot:register",
    update: ({ videos, authors }) => ({
      updates: {
        videos: {
          ...videos,
          [payload.video.videoId]: payload.video
        },
        authors: {
          ...authors,
          [payload.author.authorUrl]: payload.author
        }
      }
    })
  })
}
