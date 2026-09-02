import type { ReactElement } from "react"

import { OptionButton } from "./OptionButton"

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
      <OptionButton onClick={onToggle} size="toolbar">
        エクスポート
      </OptionButton>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-44 rounded-md border border-slate-200 bg-white text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <button
            type="button"
            onClick={() => onExport("csv", false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 hover:dark:bg-slate-800">
            CSV
          </button>
          <button
            type="button"
            onClick={() => onExport("csv", true)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 hover:dark:bg-slate-800">
            CSV (BOM)
          </button>
          <button
            type="button"
            onClick={() => onExport("tsv", false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 hover:dark:bg-slate-800">
            TSV
          </button>
        </div>
      )}
    </div>
  )
}
