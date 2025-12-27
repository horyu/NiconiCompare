type ExportMenuProps = {
  open: boolean
  onToggle: () => void
  onExport: (format: "csv" | "tsv", withBom: boolean) => void
}

export const ExportMenu = ({ open, onToggle, onExport }: ExportMenuProps) => {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100">
        エクスポート
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-md border border-slate-200 bg-white shadow-lg z-10">
          <button
            type="button"
            onClick={() => onExport("csv", false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100">
            CSV
          </button>
          <button
            type="button"
            onClick={() => onExport("csv", true)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100">
            CSV (BOM)
          </button>
          <button
            type="button"
            onClick={() => onExport("tsv", false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100">
            TSV
          </button>
        </div>
      )}
    </div>
  )
}
