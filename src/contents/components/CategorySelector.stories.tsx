import type { Meta, StoryObj } from "@storybook/react-vite"

import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_ID } from "../../lib/constants"
import { CategorySelector } from "./CategorySelector"

const sampleCategories = {
  ...DEFAULT_CATEGORIES,
  items: {
    ...DEFAULT_CATEGORIES.items,
    "11111111-1111-1111-1111-111111111111": {
      id: "11111111-1111-1111-1111-111111111111",
      name: "作画",
      createdAt: 1710000000000
    },
    "22222222-2222-2222-2222-222222222222": {
      id: "22222222-2222-2222-2222-222222222222",
      name: "ストーリー",
      createdAt: 1710000100000
    }
  },
  order: [
    DEFAULT_CATEGORY_ID,
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222"
  ],
  overlayVisibleIds: [
    DEFAULT_CATEGORY_ID,
    "11111111-1111-1111-1111-111111111111"
  ]
}

const meta: Meta<typeof CategorySelector> = {
  component: CategorySelector,
  decorators: [
    (Story) => (
      <div className="bg-slate-900 p-4 rounded-lg text-white">
        <Story />
      </div>
    )
  ],
  args: {
    categories: sampleCategories,
    activeCategoryId: DEFAULT_CATEGORY_ID,
    onChange: () => {}
  }
}

export default meta
type Story = StoryObj<typeof CategorySelector>

export const Default: Story = {}

export const ActiveNonDefault: Story = {
  args: {
    activeCategoryId: "11111111-1111-1111-1111-111111111111"
  }
}
