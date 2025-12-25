import { useMemo, useRef, useState } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import { handleUIError, NcError } from "../../lib/error-handler"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

type DataTabProps = {
  snapshot: OptionsSnapshot
  bytesInUse: number | null
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

export const DataTab = ({
  snapshot,
  bytesInUse,
  refreshState,
  showToast
}: DataTabProps) => {
  const [deletingAll, setDeletingAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFileName, setImportFileName] = useState("")
  const importFileRef = useRef<HTMLInputElement | null>(null)

  const lastCleanupLabel = useMemo(() => {
    if (!snapshot.meta?.lastCleanupAt) {
      return "未実行"
    }
    return new Date(snapshot.meta.lastCleanupAt).toLocaleString()
  }, [snapshot])

  const handleClearRetry = async (clearFailed = false) => {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.metaAction,
      payload: { action: "clearRetry", clearFailed }
    })
    await refreshState(true)
  }

  const handleCleanup = async () => {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.metaAction,
      payload: { action: "cleanup" }
    })
    await refreshState(true)
  }

  const handleDeleteAllData = async () => {
    const confirmed = confirm(
      "全データを削除します。設定・履歴・レーティングも初期化されます。続行しますか？"
    )
    if (!confirmed) {
      return
    }
    setDeletingAll(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.deleteAllData
      })
      if (!response?.ok) {
        throw new NcError(
          response?.error ?? "delete all failed",
          "options:data:delete-all",
          "全データの削除に失敗しました。"
        )
      }
      await refreshState(true)
      showToast("success", "全データを削除しました。")
    } catch (error) {
      handleUIError(error, "options:data:delete-all", showToast)
    } finally {
      setDeletingAll(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.exportData
      })
      if (!response?.ok) {
        throw new NcError(
          response?.error ?? "export failed",
          "options:data:export",
          "エクスポートに失敗しました。"
        )
      }
      const data = JSON.stringify(response.data, null, 2)
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const now = new Date()
      const pad2 = (value: number) => value.toString().padStart(2, "0")
      const filename = `NiconiCompareData-${now.getFullYear()}${pad2(
        now.getMonth() + 1
      )}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(
        now.getMinutes()
      )}${pad2(now.getSeconds())}.json`
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      showToast("success", "エクスポートしました。")
    } catch (error) {
      handleUIError(error, "options:data:export", showToast)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    const file = importFileRef.current?.files?.[0]
    if (!file) {
      showToast("error", "インポートするJSONを選択してください。")
      return
    }
    const confirmed = window.confirm(
      "現在のデータを上書きします。インポートしてもよろしいですか？"
    )
    if (!confirmed) {
      return
    }
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.importData,
        payload: { data }
      })
      if (!response?.ok) {
        throw new NcError(
          response?.error ?? "import failed",
          "options:data:import",
          "インポートに失敗しました。"
        )
      }
      if (importFileRef.current) {
        importFileRef.current.value = ""
      }
      setImportFileName("")
      await refreshState(true)
      showToast("success", "インポートしました。")
    } catch (error) {
      handleUIError(error, "options:data:import", showToast)
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold">データ操作</h2>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">エクスポート/インポート</h3>
          {bytesInUse !== null && (
            <div className="text-sm text-slate-600">
              ストレージ使用量: {(bytesInUse / 1024).toFixed(2)} KB {" / "}
              {(chrome.storage.local.QUOTA_BYTES / 1024 / 1024).toFixed(0)} MB
            </div>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100 disabled:opacity-50">
            JSON エクスポート
          </button>
          <div className="flex flex-col gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json"
              onChange={(event) => {
                setImportFileName(event.currentTarget.files?.[0]?.name ?? "")
              }}
              className="text-sm file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:hover:bg-slate-100"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !importFileName}
              className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100 disabled:opacity-50">
              JSON インポート
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">クリーンアップ</h3>
          <div className="text-sm text-slate-600">
            最終実行: {lastCleanupLabel}
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100"
            onClick={handleCleanup}>
            イベントから辿れない情報を削除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Storage 状態</h3>
          <div className="text-sm text-slate-600">
            保存再試行（イベント書き込み）: {snapshot.meta.retryQueue.length} 件
          </div>
          {snapshot.meta.retryQueue.length > 0 && (
            <button
              type="button"
              onClick={() => handleClearRetry()}
              className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100">
              保存再試行をクリア
            </button>
          )}
          <div className="text-sm text-slate-600">
            保存失敗（イベント書き込み）: {snapshot.meta.failedWrites.length} 件
          </div>
          {snapshot.meta.failedWrites.length > 0 && (
            <button
              type="button"
              onClick={() => handleClearRetry(true)}
              className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100">
              保存失敗もクリア
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-rose-700">全データ削除</h3>
          <p className="text-sm text-slate-600">
            設定・履歴・レーティングを初期化します。
          </p>
          <button
            type="button"
            onClick={handleDeleteAllData}
            disabled={deletingAll}
            className="px-3 py-2 rounded-md border border-rose-200 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50">
            全データ削除
          </button>
        </div>
      </div>
    </section>
  )
}
