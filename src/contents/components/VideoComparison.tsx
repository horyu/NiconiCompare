import type { ReactNode } from "react"

import type { VideoSnapshot } from "../../lib/types"
import { createWatchUrl } from "../../lib/url"

type VideoComparisonProps = {
  currentVideoId?: string
  opponentVideoId?: string
  opponentSelector: ReactNode
  videoSnapshots: Record<string, VideoSnapshot>
}

export function VideoComparison({
  currentVideoId,
  opponentVideoId,
  opponentSelector,
  videoSnapshots
}: VideoComparisonProps) {
  const formatVideoLabel = (videoId?: string) => {
    if (!videoId) return ""
    const snapshot = videoSnapshots[videoId]
    if (snapshot?.title) {
      return `${videoId} | ${snapshot.title}`
    }
    return videoId
  }

  const getThumbnailUrl = (videoId?: string) => {
    if (!videoId) return undefined
    return videoSnapshots[videoId]?.thumbnailUrls?.[0]
  }

  const opponentWatchUrl = opponentVideoId
    ? createWatchUrl(opponentVideoId)
    : undefined
  const opponentTitle = opponentVideoId
    ? videoSnapshots[opponentVideoId]?.title ?? ""
    : ""

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
      <div className="flex flex-col gap-2">
        {getThumbnailUrl(currentVideoId) ? (
          <img
            src={getThumbnailUrl(currentVideoId)}
            alt="現在の動画"
            className="w-full aspect-video object-cover rounded-md bg-white/10"
          />
        ) : (
          <div className="w-full aspect-video rounded-md bg-white/10" />
        )}
        <div className="text-[14px] opacity-90 text-right break-all overflow-hidden w-full">
          {currentVideoId
            ? formatVideoLabel(currentVideoId)
            : "再生中動画を検出できません"}
        </div>
      </div>

      <div className="flex items-center justify-center self-center">
        <div className="text-center text-[14px] font-bold opacity-70">vs</div>
      </div>

      <div className="flex flex-col gap-2">
        {opponentWatchUrl ? (
          <a href={opponentWatchUrl} target="_blank" rel="noreferrer">
            {getThumbnailUrl(opponentVideoId) ? (
              <img
                src={getThumbnailUrl(opponentVideoId)}
                alt="選択中の動画"
                className="w-full aspect-video object-cover rounded-md bg-white/10"
              />
            ) : (
              <div className="w-full aspect-video rounded-md bg-white/10" />
            )}
          </a>
        ) : getThumbnailUrl(opponentVideoId) ? (
          <img
            src={getThumbnailUrl(opponentVideoId)}
            alt="選択中の動画"
            className="w-full aspect-video object-cover rounded-md bg-white/10"
          />
        ) : (
          <div className="w-full aspect-video rounded-md bg-white/10" />
        )}
        {/* Wrapper to avoid inserting a gap between the selector row and title */}
        <div>
          {opponentSelector}
          <div className="text-[14px] opacity-90 self-stretch text-left break-all overflow-hidden">
            {opponentTitle}
          </div>
        </div>
      </div>
    </div>
  )
}
