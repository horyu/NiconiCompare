import type { Meta, StoryObj } from "@storybook/react-vite"

import type { VideoSnapshot } from "../../lib/types"
import { OpponentSelector } from "./OpponentSelector"

const videoSnapshots: Record<string, VideoSnapshot> = {
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
  }
}

const meta: Meta<typeof OpponentSelector> = {
  component: OpponentSelector,
  decorators: [
    (Story) => (
      <div className="bg-black/75 text-white text-sm p-3 rounded-lg shadow-lg max-w-[320px]">
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
