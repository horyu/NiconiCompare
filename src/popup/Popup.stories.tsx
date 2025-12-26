import type { Meta, StoryObj } from "@storybook/react-vite"

import { DEFAULT_META, DEFAULT_SETTINGS } from "../lib/constants"
import type { NcEventsBucket, NcMeta, NcVideos } from "../lib/types"
import Popup from "./index"

type PopupData = {
  settings: typeof DEFAULT_SETTINGS
  events: NcEventsBucket
  meta: NcMeta
  videos: NcVideos
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
        disabled: false
      },
      {
        id: 2,
        timestamp: Date.now() - 1000 * 120,
        currentVideoId: "sm3333333",
        opponentVideoId: "sm4444444",
        verdict: "same",
        disabled: false
      }
    ]
  },
  meta: { ...DEFAULT_META },
  videos: {
    sm1111111: {
      videoId: "sm1111111",
      title: "テスト動画 A",
      authorUrl: "https://www.nicovideo.jp/user/1",
      thumbnailUrls: [],
      lengthSeconds: 120,
      capturedAt: Date.now()
    },
    sm2222222: {
      videoId: "sm2222222",
      title: "テスト動画 B",
      authorUrl: "https://www.nicovideo.jp/user/2",
      thumbnailUrls: [],
      lengthSeconds: 180,
      capturedAt: Date.now()
    },
    sm3333333: {
      videoId: "sm3333333",
      title: "テスト動画 C",
      authorUrl: "https://www.nicovideo.jp/user/3",
      thumbnailUrls: [],
      lengthSeconds: 200,
      capturedAt: Date.now()
    },
    sm4444444: {
      videoId: "sm4444444",
      title: "テスト動画 D",
      authorUrl: "https://www.nicovideo.jp/user/4",
      thumbnailUrls: [],
      lengthSeconds: 240,
      capturedAt: Date.now()
    }
  }
}

const withPopupData =
  (overrides: Partial<PopupData> = {}) =>
  (Story: () => JSX.Element) => {
    const data: PopupData = {
      settings: { ...baseData.settings, ...overrides.settings },
      events: overrides.events ?? baseData.events,
      meta: { ...baseData.meta, ...overrides.meta },
      videos: overrides.videos ?? baseData.videos
    }

    globalThis.chrome = {
      runtime: {
        sendMessage: async () => ({
          ok: true,
          data
        })
      }
    } as unknown as typeof chrome

    return <Story />
  }

const withPopupFrame = (Story: () => JSX.Element) => (
  <div className="bg-white p-4 rounded-lg border border-slate-200 max-w-[360px]">
    <Story />
  </div>
)

const meta: Meta<typeof Popup> = {
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
