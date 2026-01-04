import type { ReactElement } from "react"

interface ExportMenuProps {
  open: boolean
  onToggle: () => void
  onExport: (format: "csv" | "tsv", withBom: boolean) => void
}

export const ExportMenu = ({
  open,
  onToggle,
  onExport
}: ExportMenuProps): ReactElement => {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="px-3 py-2 rounded-md border border-slate-200 text-sm bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
        エクスポート
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-md border border-slate-200 bg-white shadow-lg z-10 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <button
            type="button"
            onClick={() => onExport("csv", false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
            CSV
          </button>
          <button
            type="button"
            onClick={() => onExport("csv", true)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
            CSV (BOM)
          </button>
          <button
            type="button"
            onClick={() => onExport("tsv", false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
            TSV
          </button>
        </div>
      )}
    </div>
  )
}
