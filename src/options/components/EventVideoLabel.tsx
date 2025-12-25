import type { NcVideos } from "../../lib/types"

type EventVideoLabelProps = {
  videoId: string
  video: NcVideos[string] | undefined
  authorName?: string
  showThumbnail: boolean
}

export const EventVideoLabel = ({
  videoId,
  video,
  authorName,
  showThumbnail
}: EventVideoLabelProps) => {
  const thumbnailUrl = video?.thumbnailUrls?.[0]
  if (!video) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700">
        {showThumbnail && <div className="w-10 h-7 rounded bg-amber-100" />}
        <div className="flex flex-col">
          <span>{videoId}</span>
          <span className="text-[10px] text-amber-600">データ未取得</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {showThumbnail && (
        <div className="w-10 h-7 rounded bg-slate-200 overflow-hidden shrink-0">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <div className="text-sm font-medium break-words">{video.title}</div>
        <div className="text-[11px] text-slate-500 break-words">
          {videoId}
          {authorName ? ` | ${authorName}` : ""}
        </div>
      </div>
    </div>
  )
}
