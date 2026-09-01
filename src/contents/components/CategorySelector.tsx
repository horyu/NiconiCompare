import type { ReactElement } from "react"

import type { NcCategories } from "../../lib/types"

interface CategorySelectorProps {
  categories: NcCategories
  activeCategoryId: string
  onChange: (categoryId: string) => void
}

export function CategorySelector({
  categories,
  activeCategoryId,
  onChange
}: CategorySelectorProps): ReactElement {
  const visibleIds =
    categories.overlayVisibleIds.length > 0
      ? categories.overlayVisibleIds
      : [categories.defaultId]
  const options = categories.order.filter((id) => visibleIds.includes(id))

  return (
    <select
      className="w-full min-w-0 truncate rounded border border-white/30 bg-black/60 px-2 py-1 text-xs text-white"
      value={activeCategoryId}
      onChange={(event) => onChange(event.target.value)}>
      {options.map((id) => (
        <option key={id} value={id}>
          {categories.items[id]?.name ?? "カテゴリ"}
        </option>
      ))}
    </select>
  )
}
