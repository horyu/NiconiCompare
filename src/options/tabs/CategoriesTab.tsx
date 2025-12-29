import { useMemo, useState } from "react"

import { DEFAULT_CATEGORY_ID, MESSAGE_TYPES } from "../../lib/constants"
import { handleUIError, NcError } from "../../lib/error-handler"
import { sendNcMessage } from "../../lib/messages"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

type CategoriesTabProps = {
  snapshot: OptionsSnapshot
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

const isValidCategoryName = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > 50) {
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
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
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.createCategory,
        payload: { name: newCategoryName.trim() }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "create failed",
          "options:categories:create",
          "カテゴリの追加に失敗しました。"
        )
      }
      setNewCategoryName("")
      await refreshState(true)
      showToast("success", "カテゴリを追加しました。")
    } catch (error) {
      handleUIError(error, "options:categories:create", showToast)
    }
  }

  const handleUpdateName = async (categoryId: string) => {
    if (!isValidCategoryName(editingName)) {
      showToast("error", "カテゴリ名は1〜50文字で入力してください。")
      return
    }
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.updateCategoryName,
        payload: { categoryId, name: editingName.trim() }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "update failed",
          "options:categories:update",
          "カテゴリ名の更新に失敗しました。"
        )
      }
      setEditingId(null)
      setEditingName("")
      await refreshState(true)
      showToast("success", "カテゴリ名を更新しました。")
    } catch (error) {
      handleUIError(error, "options:categories:update", showToast)
    }
  }

  const handleDeleteCategory = async (
    categoryId: string,
    moveToCategoryId?: string
  ) => {
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.deleteCategory,
        payload: { categoryId, moveToCategoryId }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "delete failed",
          "options:categories:delete",
          "カテゴリの削除に失敗しました。"
        )
      }
      await refreshState(true)
      showToast("success", "カテゴリを削除しました。")
    } catch (error) {
      handleUIError(error, "options:categories:delete", showToast)
    }
  }

  const handleToggleOverlayVisible = async (
    categoryId: string,
    checked: boolean
  ) => {
    const current = snapshot.categories.overlayVisibleIds
    const next = checked
      ? Array.from(new Set([...current, categoryId]))
      : current.filter((id) => id !== categoryId)
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.updateOverlayVisibleIds,
        payload: { overlayVisibleIds: next }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "update failed",
          "options:categories:overlay",
          "オーバーレイ表示の更新に失敗しました。"
        )
      }
      await refreshState(true)
    } catch (error) {
      handleUIError(error, "options:categories:overlay", showToast)
    }
  }

  const handleSetActive = async (categoryId: string) => {
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.updateActiveCategory,
        payload: { categoryId }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "update failed",
          "options:categories:active",
          "カテゴリの切り替えに失敗しました。"
        )
      }
      await refreshState(true)
    } catch (error) {
      handleUIError(error, "options:categories:active", showToast)
    }
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
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.reorderCategories,
        payload: { order: nextOrder }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "reorder failed",
          "options:categories:reorder",
          "並び替えに失敗しました。"
        )
      }
      await refreshState(true)
    } catch (error) {
      handleUIError(error, "options:categories:reorder", showToast)
    }
  }

  const categoryOptions = orderedCategories

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">カテゴリ</h2>
        <div className="text-sm text-slate-500">
          {orderedCategories.length} 件
        </div>
      </header>

      <div className="flex items-end gap-3">
        <label className="text-sm flex flex-col gap-1 min-w-[240px]">
          新規カテゴリ
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1"
            placeholder="カテゴリ名を入力"
          />
        </label>
        <button
          type="button"
          onClick={handleCreateCategory}
          className="px-3 py-2 rounded border border-slate-200 text-sm hover:bg-slate-100">
          追加
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_100px_120px_1fr_140px] gap-2 bg-slate-100 text-xs font-semibold px-3 py-2">
          <div>カテゴリ名</div>
          <div>状態</div>
          <div>オーバーレイ</div>
          <div>並び替え</div>
          <div>操作</div>
        </div>
        <div className="divide-y divide-slate-100">
          {orderedCategories.map((category, index) => {
            const isDefault = category.id === DEFAULT_CATEGORY_ID
            const isActive = snapshot.settings.activeCategoryId === category.id
            const isOverlayVisible =
              snapshot.categories.overlayVisibleIds.includes(category.id)
            const moveTarget =
              moveTargets[category.id] ?? snapshot.categories.defaultId
            return (
              <div
                key={category.id}
                className="grid grid-cols-[2fr_100px_120px_1fr_140px] gap-2 items-center px-3 py-2 text-sm">
                <div className="flex flex-col gap-1">
                  {editingId === category.id ? (
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className="border border-slate-200 rounded-md px-2 py-1"
                    />
                  ) : (
                    <span className="font-medium text-slate-900">
                      {category.name}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{category.id}</span>
                </div>
                <div className="text-xs">
                  {isActive ? (
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      アクティブ
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetActive(category.id)}
                      className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100">
                      切替
                    </button>
                  )}
                </div>
                <div className="text-xs">
                  <label className="flex items-center gap-2">
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
                    className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100 disabled:opacity-50">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(category.id, 1)}
                    disabled={index === orderedCategories.length - 1}
                    className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100 disabled:opacity-50">
                    ↓
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {editingId === category.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateName(category.id)}
                        className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100">
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditingName("")
                        }}
                        className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100">
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(category.id)
                        setEditingName(category.name)
                      }}
                      className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100">
                      名称変更
                    </button>
                  )}
                  {!isDefault && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={moveTarget}
                          onChange={(event) =>
                            setMoveTargets((prev) => ({
                              ...prev,
                              [category.id]: event.target.value
                            }))
                          }
                          className="border border-slate-200 rounded-md px-2 py-1 text-xs">
                          {categoryOptions
                            .filter((item) => item.id !== category.id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCategory(category.id, moveTarget)
                          }
                          className="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100">
                          移動して削除
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="px-2 py-1 rounded border border-rose-200 text-xs text-rose-700 hover:bg-rose-50">
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
