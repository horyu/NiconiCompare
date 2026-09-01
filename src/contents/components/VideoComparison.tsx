import type { ReactElement, ReactNode } from "react"

import type { VideoSnapshot } from "../../lib/types"
import { createWatchUrl } from "../../lib/url"

interface VideoComparisonProps {
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
}: VideoComparisonProps): ReactElement {
  const formatVideoLabel = (videoId?: string): string => {
    if (!videoId) return ""
    const snapshot = videoSnapshots[videoId]
    if (snapshot?.title) {
      return `${videoId} | ${snapshot.title}`
    }
    return videoId
  }

  const getThumbnailUrl = (videoId?: string): string | undefined => {
    if (!videoId) return undefined
    return videoSnapshots[videoId]?.thumbnailUrls?.[0]
  }

  const opponentWatchUrl = opponentVideoId
    ? createWatchUrl(opponentVideoId)
    : undefined
  const opponentTitle = opponentVideoId
    ? (videoSnapshots[opponentVideoId]?.title ?? "")
    : ""

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
      <div className="flex flex-col gap-2">
        {getThumbnailUrl(currentVideoId) ? (
          <img
            src={getThumbnailUrl(currentVideoId)}
            alt="現在の動画"
            className="aspect-video w-full rounded-md bg-white/10 object-cover"
          />
        ) : (
          <div className="aspect-video w-full rounded-md bg-white/10" />
        )}
        <div className="w-full overflow-hidden text-right text-[14px] break-all opacity-90">
          {currentVideoId
            ? formatVideoLabel(currentVideoId)
            : "再生中動画を検出できません"}
        </div>
      </div>

      <div className="flex items-center justify-center self-center">
        <div className="text-center text-[14px] font-bold opacity-70">vs</div>
      </div>
      {/* サムネとopponentSelectorとの隙間調整として gap-2 ではなく gap-[7px] を使用 */}
      <div className="flex flex-col gap-[7px]">
        {opponentWatchUrl ? (
          <a href={opponentWatchUrl} target="_blank" rel="noreferrer">
            {getThumbnailUrl(opponentVideoId) ? (
              <img
                src={getThumbnailUrl(opponentVideoId)}
                alt="選択中の動画"
                className="aspect-video w-full rounded-md bg-white/10 object-cover"
              />
            ) : (
              <div className="aspect-video w-full rounded-md bg-white/10" />
            )}
          </a>
        ) : getThumbnailUrl(opponentVideoId) ? (
          <img
            src={getThumbnailUrl(opponentVideoId)}
            alt="選択中の動画"
            className="aspect-video w-full rounded-md bg-white/10 object-cover"
          />
        ) : (
          <div className="aspect-video w-full rounded-md bg-white/10" />
        )}
        {/* Wrapper to avoid inserting a gap between the selector row and title */}
        <div>
          {opponentSelector}
          {/* -mt-px で隙間を調整 */}
          <div className="-mt-px self-stretch overflow-hidden text-left text-[14px] break-all opacity-90">
            {opponentTitle}
          </div>
        </div>
      </div>
    </div>
  )
}
