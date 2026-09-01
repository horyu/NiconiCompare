import type { Meta, StoryObj } from "@storybook/react-vite"

import type { VideoSnapshot } from "../../lib/types"
import { OpponentSelector } from "./OpponentSelector"

const videoSnapshots: Record<string, VideoSnapshot> = {
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
  }
}

const meta: Meta<typeof OpponentSelector> = {
  title: "Overlay/OpponentSelector",
  component: OpponentSelector,
  decorators: [
    (Story) => (
      <div className="max-w-[320px] rounded-lg bg-black/75 p-3 text-sm text-white shadow-lg">
        <Story />
      </div>
    )
  ],
  args: {
    hasSelectableCandidates: true,
    isPinned: false,
    opponentVideoId: "sm1111111",
    onBlur: () => {},
    onChange: () => {},
    onTogglePinned: () => {},
    selectableWindow: ["sm1111111", "sm2222222"],
    videoSnapshots
  }
}

export default meta
type Story = StoryObj<typeof OpponentSelector>

export const Default: Story = {}

export const NoCandidates: Story = {
  args: {
    hasSelectableCandidates: false,
    opponentVideoId: undefined,
    selectableWindow: []
  }
}

export const Pinned: Story = {
  args: {
    isPinned: true
  }
}
