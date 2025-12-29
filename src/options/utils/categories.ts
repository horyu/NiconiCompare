import type { NcCategories } from "../../lib/types"

export type CategoryOption = {
  id: string
  name: string
}

export const buildCategoryOptions = (
  categories: NcCategories
): CategoryOption[] => {
  return categories.order
    .filter((id) => categories.items[id])
    .map((id) => ({
      id,
      name: categories.items[id]?.name ?? "カテゴリ"
    }))
}
