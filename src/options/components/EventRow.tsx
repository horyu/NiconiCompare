import type { ReactElement } from "react"

import { formatPaddedDateTime } from "../../lib/date"
import type { CompareEvent, Verdict } from "../../lib/types"
import { VERDICTS } from "../../lib/types"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { CategorySelect } from "./CategorySelect"
import { EventVideoLabel } from "./EventVideoLabel"

interface EventRowProps {
  event: CompareEvent
  showCategoryOps: boolean
  isBusy: boolean
  currentVideo?: OptionsSnapshot["videos"][string]
  opponentVideo?: OptionsSnapshot["videos"][string]
  currentAuthorName?: string
  opponentAuthorName?: string
  showThumbnails: boolean
  isCurrentWinner: boolean
  isOpponentWinner: boolean
  timestamp: Date
  rowMoveTargets: { id: string; name: string }[]
  rowMoveTargetId: string
  onVerdictChange: (target: CompareEvent, verdict: Verdict) => void
  onMoveTargetChange: (value: string) => void
  onMoveEvent: (eventId: number, targetCategoryId: string) => void
  onDeleteEvent: (eventId: number) => void
  onRestoreEvent: (eventId: number) => void
  onPurgeEvent: (eventId: number) => void
}

const isVerdict = (value: string): value is Verdict =>
  (VERDICTS as readonly string[]).includes(value)

export function EventRow({
  event,
  showCategoryOps,
  isBusy,
  currentVideo,
  opponentVideo,
  currentAuthorName,
  opponentAuthorName,
  showThumbnails,
  isCurrentWinner,
  isOpponentWinner,
  timestamp,
  rowMoveTargets,
  rowMoveTargetId,
  onVerdictChange,
  onMoveTargetChange,
  onMoveEvent,
  onDeleteEvent,
  onRestoreEvent,
  onPurgeEvent
}: EventRowProps): ReactElement {
  return (
    <div
      className={`grid ${
        showCategoryOps
          ? "grid-cols-[40px_70px_1fr_1fr_90px_160px_90px]"
          : "grid-cols-[40px_70px_1fr_1fr_90px_90px]"
      } gap-2 items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200`}>
      <div className="font-medium flex flex-col gap-1 items-center">
        <span>#{event.id}</span>
        {event.disabled && (
          <span className="text-[10px] px-2 py-[1px] rounded-full bg-slate-100 text-slate-500 border border-slate-200 w-fit dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            無効
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {formatPaddedDateTime(timestamp)}
      </div>
      <div
        className={isCurrentWinner ? "border-l-4 border-l-slate-400 pl-2" : ""}>
        <EventVideoLabel
          videoId={event.currentVideoId}
          video={currentVideo}
          authorName={currentAuthorName}
          showThumbnail={showThumbnails}
        />
      </div>
      <div
        className={
          isOpponentWinner ? "border-l-4 border-l-slate-400 pl-2" : ""
        }>
        <EventVideoLabel
          videoId={event.opponentVideoId}
          video={opponentVideo}
          authorName={opponentAuthorName}
          showThumbnail={showThumbnails}
        />
      </div>
      <select
        value={event.verdict}
        disabled={event.disabled || isBusy}
        onChange={(e) => {
          const { value } = e.target
          if (isVerdict(value)) {
            onVerdictChange(event, value)
          }
        }}
        className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <option value="better">勝ち</option>
        <option value="same">引き分け</option>
        <option value="worse">負け</option>
      </select>
      {showCategoryOps && (
        <div className="flex items-center gap-2">
          {rowMoveTargets.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              移動先なし
            </span>
          ) : (
            <>
              <div className="w-[15ch] max-w-[15ch]">
                <CategorySelect
                  value={rowMoveTargetId}
                  onChange={onMoveTargetChange}
                  options={rowMoveTargets}
                  size="sm"
                />
              </div>
              <button
                type="button"
                onClick={() => onMoveEvent(event.id, rowMoveTargetId)}
                disabled={!rowMoveTargetId || isBusy}
                className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                移動
              </button>
            </>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {!event.disabled ? (
          <button
            type="button"
            onClick={() => onDeleteEvent(event.id)}
            disabled={isBusy}
            className="px-3 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
            無効化
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onRestoreEvent(event.id)}
              disabled={isBusy}
              className="px-3 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              有効化
            </button>
            <button
              type="button"
              onClick={() => onPurgeEvent(event.id)}
              disabled={isBusy}
              className="px-3 py-1 rounded border border-rose-200 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-200 dark:hover:bg-rose-950/40">
              削除
            </button>
          </>
        )}
      </div>
    </div>
  )
}
