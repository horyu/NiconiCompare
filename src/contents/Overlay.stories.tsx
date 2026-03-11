import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, type ReactElement } from "react"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  MESSAGE_TYPES,
  STORAGE_KEYS
} from "../lib/constants"
import type {
  NcCategories,
  NcSettings,
  NcState,
  VideoSnapshot
} from "../lib/types"
import Overlay from "./overlay"

interface OverlayStateResponse {
  settings: NcSettings
  state: NcState
  categories: NcCategories
}

const now = Date.now()

const videos: Record<string, VideoSnapshot> = {
  sm1111111: {
    videoId: "sm1111111",
    title: "テスト動画 A",
    authorUrl: "https://www.nicovideo.jp/user/1",
    thumbnailUrls: [],
    capturedAt: now
  },
  sm2222222: {
    videoId: "sm2222222",
    title: "テスト動画 B",
    authorUrl: "https://www.nicovideo.jp/user/2",
    thumbnailUrls: [],
    capturedAt: now
  },
  sm3333333: {
    videoId: "sm3333333",
    title: "テスト動画 C",
    authorUrl: "https://www.nicovideo.jp/user/3",
    thumbnailUrls: [],
    capturedAt: now
  }
}

const baseRequestStateData: OverlayStateResponse = {
  settings: {
    ...DEFAULT_SETTINGS,
    overlayAndCaptureEnabled: true,
    overlayAutoCloseMs: 999_999,
    activeCategoryId: DEFAULT_CATEGORY_ID
  },
  state: {
    ...DEFAULT_STATE,
    currentVideoId: "sm1111111",
    recentWindow: ["sm2222222", "sm3333333"]
  },
  categories: {
    ...DEFAULT_CATEGORIES
  }
}

function withChromeMock(overrides?: {
  settings?: Partial<NcSettings>
  state?: Partial<NcState>
  categories?: Partial<NcCategories>
}) {
  const requestStateData: OverlayStateResponse = {
    settings: {
      ...baseRequestStateData.settings,
      ...overrides?.settings
    },
    state: {
      ...baseRequestStateData.state,
      ...overrides?.state
    },
    categories: {
      ...baseRequestStateData.categories,
      ...overrides?.categories
    }
  }

  return (Story: () => ReactElement): ReactElement => {
    const windowWithChrome = globalThis as typeof globalThis & {
      chrome: typeof chrome
    }
    windowWithChrome.chrome = {
      runtime: {
        sendMessage: (message: { type: string }) => {
          switch (message.type) {
            case MESSAGE_TYPES.requestState:
              return Promise.resolve({
                ok: true,
                data: requestStateData
              })
            default:
              return Promise.resolve({ ok: true })
          }
        }
      },
      storage: {
        local: {
          get: (keys?: string | string[]) => {
            if (keys === STORAGE_KEYS.videos) {
              return Promise.resolve({ [STORAGE_KEYS.videos]: videos })
            }
            if (Array.isArray(keys) && keys.includes(STORAGE_KEYS.videos)) {
              return Promise.resolve({ [STORAGE_KEYS.videos]: videos })
            }
            return Promise.resolve({})
          }
        },
        onChanged: {
          addListener: () => {},
          removeListener: () => {}
        }
      }
    } as unknown as typeof chrome

    return <Story />
  }
}

function WithLdJsonDecorator({
  Story
}: {
  Story: () => ReactElement
}): ReactElement {
  useEffect(() => {
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.textContent = JSON.stringify({
      "@type": "VideoObject",
      videoId: "sm1111111",
      name: "テスト動画 A",
      thumbnailUrl: [],
      author: {
        name: "投稿者A",
        url: "https://www.nicovideo.jp/user/1"
      }
    })
    document.head.append(script)
    return () => {
      script.remove()
    }
  }, [])
  return <Story />
}

const meta: Meta<typeof Overlay> = {
  title: "Overlay/Overlay",
  component: Overlay,
  decorators: [
    (Story) => <WithLdJsonDecorator Story={Story} />,
    (Story) => (
      <div className="overlay-story-sandbox relative h-[320px] w-[400px] bg-slate-900 p-4">
        <style>
          {`
            .overlay-story-sandbox .fixed.top-0.right-0 {
              position: absolute !important;
            }
          `}
        </style>
        <Story />
      </div>
    )
  ]
}

export default meta
type Story = StoryObj<typeof Overlay>

export const Expanded: Story = {
  decorators: [withChromeMock()]
}

export const Unexpanded: Story = {
  decorators: [
    withChromeMock({
      settings: {
        overlayAutoCloseMs: 1
      }
    })
  ]
}
