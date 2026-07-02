import type { ReactElement } from "react"

import { formatPaddedDateTime } from "../../lib/date"
import type { RatingSnapshot, VideoSnapshot } from "../../lib/types"
import { createWatchUrl } from "../../lib/url"

interface VideoRowProps {
  rowNumber: number
  video: VideoSnapshot
  rating?: RatingSnapshot
  authorName?: string
  verdictCounts: { wins: number; draws: number; losses: number }
  lastVerdictAt?: number
  categoryId: string
  onOpenEventsForVideo?: (videoId: string, categoryId: string) => void
}

export function VideoRow({
  rowNumber,
  video,
  rating,
  authorName,
  verdictCounts,
  lastVerdictAt,
  categoryId,
  onOpenEventsForVideo
}: VideoRowProps): ReactElement {
  const verdictTotal =
    verdictCounts.wins + verdictCounts.draws + verdictCounts.losses
  return (
    <div className="grid grid-cols-[28px_90px_1fr_130px_40px_30px_40px_50px_110px] gap-2 items-center px-3 py-2">
      <div className="text-xs text-slate-600 dark:text-slate-400">
        {rowNumber}
      </div>
      <a
        href={createWatchUrl(video.videoId)}
        target="_blank"
        rel="noreferrer"
        className="w-20 h-12 bg-slate-200 rounded overflow-hidden block dark:bg-slate-700">
        {video.thumbnailUrls?.[0] ? (
          <img
            src={video.thumbnailUrls[0]}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : null}
      </a>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {video.title || "データ未取得"}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {video.videoId}
        </span>
      </div>
      <div className="text-sm text-slate-700 dark:text-slate-200">
        {authorName ?? "不明"}
      </div>
      <div className="text-sm text-slate-700 dark:text-slate-200">
        {rating ? Math.round(rating.rating) : "-"}
      </div>
      <div className="text-sm text-slate-700 dark:text-slate-200">
        {rating ? Math.round(rating.rd) : "-"}
      </div>
      <div className="text-sm">
        {verdictTotal > 0 && onOpenEventsForVideo ? (
          <button
            type="button"
            onClick={() => onOpenEventsForVideo(video.videoId, categoryId)}
            className="text-sky-700 underline decoration-sky-500 decoration-1 underline-offset-2 hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:text-sky-300 dark:hover:text-sky-200">
            {verdictTotal}
          </button>
        ) : (
          <span className="text-slate-700 dark:text-slate-200">
            {verdictTotal > 0 ? verdictTotal : "-"}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-400">
        {verdictTotal > 0
          ? `${verdictCounts.wins}/${verdictCounts.draws}/${verdictCounts.losses}`
          : "-"}
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-400">
        {lastVerdictAt ? formatPaddedDateTime(new Date(lastVerdictAt)) : "-"}
      </div>
    </div>
  )
}
