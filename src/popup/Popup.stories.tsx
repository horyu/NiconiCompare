import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactElement } from "react"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_META,
  DEFAULT_SETTINGS
} from "../lib/constants"
import type {
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcVideos
} from "../lib/types"
import Popup from "./index"

interface PopupData {
  settings: typeof DEFAULT_SETTINGS
  events: NcEventsBucket
  meta: NcMeta
  videos: NcVideos
  categories: NcCategories
}

const baseData: PopupData = {
  settings: { ...DEFAULT_SETTINGS, overlayAndCaptureEnabled: true },
  events: {
    nextId: 3,
    items: [
      {
        id: 1,
        timestamp: Date.now() - 1000 * 60,
        currentVideoId: "sm1111111",
        opponentVideoId: "sm2222222",
        verdict: "better",
        disabled: false,
        categoryId: DEFAULT_CATEGORY_ID
      },
      {
        id: 2,
        timestamp: Date.now() - 1000 * 120,
        currentVideoId: "sm3333333",
        opponentVideoId: "sm4444444",
        verdict: "same",
        disabled: false,
        categoryId: DEFAULT_CATEGORY_ID
      }
    ]
  },
  meta: { ...DEFAULT_META },
  categories: { ...DEFAULT_CATEGORIES },
  videos: {
    sm1111111: {
      videoId: "sm1111111",
      title: "テスト動画 A",
      authorUrl: "https://www.nicovideo.jp/user/1",
      thumbnailUrls: [],
      capturedAt: Date.now()
    },
    sm2222222: {
      videoId: "sm2222222",
      title: "テスト動画 B",
      authorUrl: "https://www.nicovideo.jp/user/2",
      thumbnailUrls: [],
      capturedAt: Date.now()
    },
    sm3333333: {
      videoId: "sm3333333",
      title: "テスト動画 C",
      authorUrl: "https://www.nicovideo.jp/user/3",
      thumbnailUrls: [],
      capturedAt: Date.now()
    },
    sm4444444: {
      videoId: "sm4444444",
      title: "テスト動画 D",
      authorUrl: "https://www.nicovideo.jp/user/4",
      thumbnailUrls: [],
      capturedAt: Date.now()
    }
  }
}

const withPopupData =
  (overrides: Partial<PopupData> = {}) =>
  (Story: () => ReactElement) => {
    const data: PopupData = {
      settings: { ...baseData.settings, ...overrides.settings },
      events: overrides.events ?? baseData.events,
      meta: { ...baseData.meta, ...overrides.meta },
      videos: overrides.videos ?? baseData.videos,
      categories: overrides.categories ?? baseData.categories
    }

    const windowWithChrome = globalThis as typeof globalThis & {
      chrome: typeof chrome
    }
    windowWithChrome.chrome = {
      runtime: {
        sendMessage: () =>
          Promise.resolve({
            ok: true,
            data
          })
      }
    } as unknown as typeof chrome

    return <Story />
  }

const withPopupFrame = (Story: () => ReactElement) => (
  <div className="bg-white p-4 rounded-lg border border-slate-200 max-w-[360px]">
    <Story />
  </div>
)

const meta: Meta<typeof Popup> = {
  title: "Popup/Popup",
  component: Popup,
  decorators: [withPopupData(), withPopupFrame]
}

export default meta
type Story = StoryObj<typeof Popup>

export const Default: Story = {}

export const EmptyEvents: Story = {
  decorators: [
    withPopupData({
      events: {
        nextId: 1,
        items: []
      }
    })
  ]
}
