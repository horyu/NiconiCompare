import type { VideoSnapshot } from "../../lib/types"

type OpponentSelectorProps = {
  hasSelectableCandidates: boolean
  isPinned: boolean
  opponentVideoId?: string
  onBlur: () => void
  onChange: (videoId: string) => void
  onTogglePinned: () => void
  selectableWindow: string[]
  videoSnapshots: Record<string, VideoSnapshot>
}

export function OpponentSelector({
  hasSelectableCandidates,
  isPinned,
  opponentVideoId,
  onBlur,
  onChange,
  onTogglePinned,
  selectableWindow,
  videoSnapshots
}: OpponentSelectorProps) {
  const formatVideoLabel = (videoId?: string) => {
    if (!videoId) return ""
    const snapshot = videoSnapshots[videoId]
    if (snapshot?.title) {
      return `${videoId} | ${snapshot.title}`
    }
    return videoId
  }

  return (
    <div className="w-full flex items-center gap-1">
      <label htmlFor="nc-select" className="relative flex-1 flex items-center">
        <span className="px-1.5 pr-6 rounded border border-white/30 bg-[#1f1f1f] text-[14px] overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none w-full">
          {opponentVideoId
            ? opponentVideoId
            : hasSelectableCandidates
              ? "比較候補を選択してください"
              : "比較対象がありません"}
        </span>
        <span className="absolute right-2 text-[10px] opacity-70 pointer-events-none">
          ▼
        </span>
        <select
          id="nc-select"
          value={opponentVideoId ?? ""}
          disabled={isPinned}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={[
            "absolute inset-0 opacity-0 z-[5] text-black bg-white",
            isPinned ? "cursor-not-allowed" : "cursor-pointer"
          ].join(" ")}>
          {!hasSelectableCandidates ? (
            <option value="">比較候補なし</option>
          ) : (
            selectableWindow.map((id, index) => (
              <option key={id} value={id}>
                {index + 1}. {formatVideoLabel(id)}
              </option>
            ))
          )}
        </select>
      </label>
      <button
        type="button"
        onClick={onTogglePinned}
        disabled={!opponentVideoId}
        title={isPinned ? "固定解除" : "比較対象を固定"}
        className="px-1.5 py-1 rounded border border-white/30 bg-[#1f1f1f] text-[12px] leading-none disabled:opacity-40">
        <span className="inline-block filter grayscale">
          {isPinned ? "🔒" : "🔓"}
        </span>
      </button>
    </div>
  )
}
