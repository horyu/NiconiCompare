import type { Verdict } from "../../lib/types"

type VerdictButtonsProps = {
  canSubmit: boolean
  lastVerdict?: Verdict
  onSubmit: (verdict: Verdict) => void
}

export function VerdictButtons({
  canSubmit,
  lastVerdict,
  onSubmit
}: VerdictButtonsProps) {
  const getVerdictButtonClass = (verdict: Verdict) =>
    [
      "px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap w-full text-[14px]",
      lastVerdict === verdict
        ? "bg-white text-black shadow-inner ring-2 ring-white/80"
        : "bg-white/20 hover:bg-white/30"
    ].join(" ")

  return (
    <div className="grid grid-cols-[105px_70px_105px] gap-2 items-center">
      <button
        onClick={() => onSubmit("better")}
        aria-pressed={lastVerdict === "better"}
        disabled={!canSubmit}
        className={getVerdictButtonClass("better")}>
        再生中の動画
      </button>
      <button
        onClick={() => onSubmit("same")}
        aria-pressed={lastVerdict === "same"}
        disabled={!canSubmit}
        className={getVerdictButtonClass("same")}>
        引き分け
      </button>
      <button
        onClick={() => onSubmit("worse")}
        aria-pressed={lastVerdict === "worse"}
        disabled={!canSubmit}
        className={getVerdictButtonClass("worse")}>
        選択中の動画
      </button>
    </div>
  )
}
