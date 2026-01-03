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
}: CategorySelectorProps) {
  const visibleIds =
    categories.overlayVisibleIds.length > 0
      ? categories.overlayVisibleIds
      : [categories.defaultId]
  const options = categories.order.filter((id) => visibleIds.includes(id))

  return (
    <select
      className="w-[180px] max-w-[180px] bg-black/60 text-white text-xs border border-white/30 rounded px-2 py-1 truncate"
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
