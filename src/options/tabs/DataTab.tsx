import { useEffect, useRef, useState, type ReactElement } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import { formatCompactTimestamp } from "../../lib/date"
import { handleUIError } from "../../lib/errorHandler"
import { sendNcMessage } from "../../lib/messages"
import { runNcAction } from "../../lib/ncAction"
import { CategorySelect } from "../components/CategorySelect"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { buildShareExportFilename, buildShareHtml } from "../utils/buildHtml"
import { buildCategoryOptions } from "../utils/categories"

interface DataTabProps {
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
}: DataTabProps): ReactElement => {
  const [deletingAll, setDeletingAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingHtml, setExportingHtml] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFileName, setImportFileName] = useState("")
  const categoryOptions = buildCategoryOptions(snapshot.categories)
  const initialHtmlExportCategoryId = snapshot.categories.items[
    snapshot.settings.activeCategoryId
  ]
    ? snapshot.settings.activeCategoryId
    : snapshot.categories.defaultId
  const [htmlExportCategoryId, setHtmlExportCategoryId] = useState(
    initialHtmlExportCategoryId
  )
  const importFileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (snapshot.categories.items[htmlExportCategoryId]) {
      return
    }
    setHtmlExportCategoryId(initialHtmlExportCategoryId)
  }, [htmlExportCategoryId, initialHtmlExportCategoryId, snapshot.categories])

  const lastCleanupLabel = snapshot.meta?.lastCleanupAt
    ? new Date(snapshot.meta.lastCleanupAt).toLocaleString()
    : "未実行"

  const handleCleanup = async (): Promise<void> => {
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.metaAction,
          payload: { action: "cleanup" }
        }),
      {
        context: "ui:options:data:cleanup",
        errorMessage: "クリーンアップに失敗しました。",
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleDeleteAllData = async (): Promise<void> => {
    const confirmed = confirm(
      "全データを削除します。設定・カテゴリ・評価履歴・レーティング・動画/投稿者データ・メタ情報を初期化します。続行しますか？"
    )
    if (!confirmed) {
      return
    }
    setDeletingAll(true)
    try {
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.deleteAllData
          }),
        {
          context: "ui:options:data:delete-all",
          errorMessage: "全データの削除に失敗しました。",
          successMessage: "全データを削除しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    } finally {
      setDeletingAll(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const response = await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.exportData
          }),
        {
          context: "ui:options:data:export",
          errorMessage: "エクスポートに失敗しました。",
          showToast
        }
      )
      if (!response) {
        return
      }
      const data = JSON.stringify(response.data, null, 2)
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const filename = `NiconiCompareData-${formatCompactTimestamp(new Date())}.json`
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      handleUIError(error, "ui:options:data:export", showToast)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (): Promise<void> => {
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
      const data = JSON.parse(text) as unknown
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        showToast("error", "無効なインポートデータです。")
        throw new Error("invalid import payload")
      }
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.importData,
            // oxlint-disable-next-line no-unsafe-type-assertion
            payload: { data: data as Record<string, unknown> }
          }),
        {
          context: "ui:options:data:import",
          errorMessage: "インポートに失敗しました。",
          successMessage: "インポートしました。",
          showToast,
          refreshState: () => refreshState(true),
          onSuccess: () => {
            if (importFileRef.current) {
              importFileRef.current.value = ""
            }
            setImportFileName("")
          }
        }
      )
    } catch (error) {
      handleUIError(error, "ui:options:data:import", showToast)
    } finally {
      setImporting(false)
    }
  }

  const handleShareHtmlExport = (): void => {
    setExportingHtml(true)
    try {
      const html = buildShareHtml({
        snapshot,
        categoryId: htmlExportCategoryId
      })
      const categoryName =
        snapshot.categories.items[htmlExportCategoryId]?.name ??
        htmlExportCategoryId
      const blob = new Blob([html], {
        type: "text/html;charset=utf-8"
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = buildShareExportFilename(categoryName)
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      handleUIError(error, "ui:options:data:share-html-export", showToast)
    } finally {
      setExportingHtml(false)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-6 dark:bg-slate-900 dark:border-slate-700">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          データ操作
        </h2>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            エクスポート/インポート
          </h3>
          {bytesInUse !== null && (
            <div className="text-sm text-slate-600 dark:text-slate-400">
              ストレージ使用量: {(bytesInUse / 1024).toFixed(2)} KB {" / "}
              {(chrome.storage.local.QUOTA_BYTES / 1024 / 1024).toFixed(0)} MB
            </div>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-2 rounded-md border border-slate-200 text-sm bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
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
              className="text-sm text-slate-700 dark:text-slate-200 file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:hover:bg-slate-100 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-100 dark:file:hover:bg-slate-800"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !importFileName}
              title={
                !importFileName ? "ファイルを選択してください。" : undefined
              }
              className="px-3 py-2 rounded-md border border-slate-200 text-sm bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              JSON インポート
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            共有HTML出力
          </h3>
          <CategorySelect
            value={htmlExportCategoryId}
            options={categoryOptions}
            onChange={setHtmlExportCategoryId}
            className="w-full"
          />
          <button
            type="button"
            onClick={handleShareHtmlExport}
            disabled={exportingHtml}
            className="px-3 py-2 rounded-md border border-slate-200 text-sm bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
            共有HTML エクスポート
          </button>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            クリーンアップ
          </h3>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            最終実行: {lastCleanupLabel}
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-md border border-slate-200 text-sm bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={handleCleanup}>
            孤立データ（動画/投稿者）を削除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-200">
            全データ削除
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            設定・カテゴリ・評価履歴・レーティング・動画/投稿者データ・メタ情報を初期化します。
          </p>
          <button
            type="button"
            onClick={handleDeleteAllData}
            disabled={deletingAll}
            className="px-3 py-2 rounded-md border border-rose-200 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-200 dark:hover:bg-rose-950/40">
            全データ削除
          </button>
        </div>
      </div>
    </section>
  )
}
