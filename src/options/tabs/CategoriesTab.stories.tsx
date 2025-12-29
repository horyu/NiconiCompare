import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { CategoriesTab } from "./CategoriesTab"

const baseSnapshot: OptionsSnapshot = {
  settings: { ...DEFAULT_SETTINGS },
  state: { ...DEFAULT_STATE },
  videos: {},
  authors: {},
  events: { ...DEFAULT_EVENTS_BUCKET },
  ratings: {},
  meta: { ...DEFAULT_META },
  categories: {
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
      },
      "33333333-3333-3333-3333-333333333333": {
        id: "33333333-3333-3333-3333-333333333333",
        name: "12345678901234567890123456789012345678901234567890",
        createdAt: 1710000200000
      }
    },
    order: [
      DEFAULT_CATEGORY_ID,
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333"
    ],
    overlayVisibleIds: [
      DEFAULT_CATEGORY_ID,
      "11111111-1111-1111-1111-111111111111"
    ]
  }
}

const meta: Meta<typeof CategoriesTab> = {
  component: CategoriesTab,
  decorators: [
    (Story) => (
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <Story />
      </div>
    )
  ],
  args: {
    snapshot: baseSnapshot,
    refreshState: async () => {},
    showToast: () => {}
  }
}

export default meta
type Story = StoryObj<typeof CategoriesTab>

export const Default: Story = {}

export const ActiveCustom: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      settings: {
        ...baseSnapshot.settings,
        activeCategoryId: "11111111-1111-1111-1111-111111111111"
      }
    }
  }
}
