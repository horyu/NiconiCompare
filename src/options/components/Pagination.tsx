import type { ReactElement } from "react"

interface PaginationProps {
  current: number
  total: number
  onChange: (next: number) => void
}

export const Pagination = ({
  current,
  total,
  onChange
}: PaginationProps): ReactElement => {
  const canGoPrev = current > 1
  const canGoNext = current < total
  const pageOptions = Array.from({ length: total }, (_, index) => index + 1)
  return (
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={!canGoPrev}
        onClick={() => onChange(current - 1)}
        className="rounded border border-slate-200 bg-white px-3 py-1 text-slate-900 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 hover:dark:bg-slate-800">
        前へ
      </button>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <select
          value={current}
          onChange={(event) => onChange(Number(event.target.value))}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {pageOptions.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </select>
        <span>/ {total}</span>
      </div>
      <button
        type="button"
        disabled={!canGoNext}
        onClick={() => onChange(current + 1)}
        className="rounded border border-slate-200 bg-white px-3 py-1 text-slate-900 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 hover:dark:bg-slate-800">
        次へ
      </button>
    </div>
  )
}
