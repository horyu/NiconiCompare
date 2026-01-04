import { useMemo, useState } from "react"

import { DEFAULT_CATEGORY_ID, MESSAGE_TYPES } from "../../lib/constants"
import { sendNcMessage } from "../../lib/messages"
import { runNcAction } from "../../lib/nc-action"
import { CategorySelect } from "../components/CategorySelect"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

interface CategoriesTabProps {
  snapshot: OptionsSnapshot
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

const isValidCategoryName = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 50) {
    return false
  }
  if (/[\\/:*?"<>|]/.test(trimmed)) {
    return false
  }
  return /^[\p{L}\p{N} ・_-]+$/u.test(trimmed)
}

export const CategoriesTab = ({
  snapshot,
  refreshState,
  showToast
}: CategoriesTabProps) => {
  const [newCategoryName, setNewCategoryName] = useState("")
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({})

  const orderedCategories = useMemo(() => {
    return snapshot.categories.order
      .map((id) => snapshot.categories.items[id])
      .filter(Boolean)
  }, [snapshot.categories])

  const handleCreateCategory = async () => {
    if (!isValidCategoryName(newCategoryName)) {
      showToast("error", "カテゴリ名は1〜50文字で入力してください。")
      return
    }
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.createCategory,
          payload: { name: newCategoryName.trim() }
        }),
      {
        context: "ui:options:categories:create",
        errorMessage: "カテゴリの追加に失敗しました。",
        successMessage: "カテゴリを追加しました。",
        showToast,
        refreshState: () => refreshState(true),
        onSuccess: () => setNewCategoryName("")
      }
    )
  }

  const handleUpdateName = async (categoryId: string, nextName: string) => {
    if (!isValidCategoryName(nextName)) {
      showToast("error", "カテゴリ名は1〜50文字で入力してください。")
      return
    }
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.updateCategoryName,
          payload: { categoryId, name: nextName.trim() }
        }),
      {
        context: "ui:options:categories:update",
        errorMessage: "カテゴリ名の更新に失敗しました。",
        successMessage: "カテゴリ名を更新しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleDeleteCategory = async (
    categoryId: string,
    moveToCategoryId?: string
  ) => {
    const target = snapshot.categories.items[categoryId]
    const targetName = target?.name ?? categoryId
    const moveTargetName = moveToCategoryId
      ? (snapshot.categories.items[moveToCategoryId]?.name ?? moveToCategoryId)
      : null
    const confirmed = window.confirm(
      moveToCategoryId
        ? `カテゴリ「${targetName}」に属する比較履歴を「${moveTargetName}」へ移動して削除します。レーティングは自動で再計算されます。よろしいですか？`
        : `カテゴリ「${targetName}」に属する比較履歴とレーティング一覧を破棄して削除します。よろしいですか？`
    )
    if (!confirmed) {
      return
    }
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.deleteCategory,
          payload: { categoryId, moveToCategoryId }
        }),
      {
        context: "ui:options:categories:delete",
        errorMessage: "カテゴリの削除に失敗しました。",
        successMessage: "カテゴリを削除しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleToggleOverlayVisible = async (
    categoryId: string,
    checked: boolean
  ) => {
    const current = snapshot.categories.overlayVisibleIds
    const next = checked
      ? Array.from(new Set([...current, categoryId]))
      : current.filter((id) => id !== categoryId)
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.updateOverlayVisibleIds,
          payload: { overlayVisibleIds: next }
        }),
      {
        context: "ui:options:categories:overlay",
        errorMessage: "オーバーレイ表示の更新に失敗しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleMove = async (categoryId: string, direction: -1 | 1) => {
    const order = snapshot.categories.order
    const index = order.indexOf(categoryId)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= order.length) {
      return
    }
    const nextOrder = [...order]
    const [removed] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, removed)
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.reorderCategories,
          payload: { order: nextOrder }
        }),
      {
        context: "ui:options:categories:reorder",
        errorMessage: "並び替えに失敗しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const categoryOptions = orderedCategories.map((category) => ({
    id: category.id,
    name: category.name
  }))

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4 dark:bg-slate-900 dark:border-slate-700">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          カテゴリ
        </h2>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {orderedCategories.length} 件
        </div>
      </header>

      <div className="flex items-end gap-3">
        <label className="text-sm flex flex-col gap-1 min-w-[240px] text-slate-700 dark:text-slate-200">
          新規カテゴリ
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="カテゴリ名を入力"
          />
        </label>
        <button
          type="button"
          onClick={handleCreateCategory}
          className="px-3 py-2 rounded border border-slate-200 text-sm bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          追加
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden dark:border-slate-700">
        <div className="grid grid-cols-[1fr_140px_100px_100px_100px_190px] gap-2 bg-slate-100 text-xs font-semibold px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <div>カテゴリ名</div>
          <div>作成日時</div>
          <div>状態</div>
          <div>オーバーレイ</div>
          <div>並び替え</div>
          <div>操作</div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {orderedCategories.map((category, index) => {
            const isDefault = category.id === DEFAULT_CATEGORY_ID
            const isActive = snapshot.settings.activeCategoryId === category.id
            const isOverlayVisible =
              snapshot.categories.overlayVisibleIds.includes(category.id)
            const moveTarget =
              moveTargets[category.id] ?? snapshot.categories.defaultId
            const createdAt = new Date(category.createdAt)
            return (
              <div
                key={category.id}
                className="grid grid-cols-[1fr_140px_100px_100px_100px_190px] gap-2 items-center px-3 py-2 text-sm">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-medium text-slate-900 break-words whitespace-normal dark:text-slate-100">
                    {category.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {category.id}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <div>{createdAt.toLocaleDateString()}</div>
                  <div>{createdAt.toLocaleTimeString()}</div>
                </div>
                <div className="text-xs">
                  {isActive ? (
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                      アクティブ
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      非アクティブ
                    </span>
                  )}
                </div>
                <div className="text-xs">
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={isOverlayVisible}
                      onChange={(event) =>
                        handleToggleOverlayVisible(
                          category.id,
                          event.target.checked
                        )
                      }
                    />
                    表示
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMove(category.id, -1)}
                    disabled={index === 0}
                    className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(category.id, 1)}
                    disabled={index === orderedCategories.length - 1}
                    className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                    ↓
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextName = window.prompt(
                        "カテゴリ名を入力してください。",
                        category.name
                      )
                      if (nextName === null) {
                        return
                      }
                      const trimmed = nextName.trim()
                      if (trimmed === category.name) {
                        return
                      }
                      void handleUpdateName(category.id, trimmed)
                    }}
                    className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                    名称変更
                  </button>
                  {!isDefault && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <CategorySelect
                          value={moveTarget}
                          onChange={(value) =>
                            setMoveTargets((prev) => ({
                              ...prev,
                              [category.id]: value
                            }))
                          }
                          options={categoryOptions.filter(
                            (item) => item.id !== category.id
                          )}
                          size="sm"
                          className="w-[15ch] max-w-[15ch]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCategory(category.id, moveTarget)
                          }
                          className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                          移動して削除
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="px-2 py-1 rounded border border-rose-200 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-200 dark:hover:bg-rose-950/40">
                        破棄して削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
