import type { Meta, StoryObj } from "@storybook/react-vite"

import type { VideoSnapshot } from "../../lib/types"
import { OpponentSelector } from "./OpponentSelector"
import { VideoComparison } from "./VideoComparison"

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

const meta: Meta<typeof VideoComparison> = {
  title: "Overlay/VideoComparison",
  component: VideoComparison,
  decorators: [
    (Story) => (
      <div className="bg-black/75 text-white text-sm p-3 rounded-lg shadow-lg max-w-[320px]">
        <Story />
      </div>
    )
  ],
  args: {
    currentVideoId: "sm1111111",
    opponentVideoId: "sm2222222",
    videoSnapshots,
    opponentSelector: (
      <OpponentSelector
        hasSelectableCandidates
        isPinned={false}
        opponentVideoId="sm2222222"
        onBlur={() => {}}
        onChange={() => {}}
        onTogglePinned={() => {}}
        selectableWindow={["sm1111111", "sm2222222"]}
        videoSnapshots={videoSnapshots}
      />
    )
  }
}

export default meta
type Story = StoryObj<typeof VideoComparison>

export const Default: Story = {}

export const MissingOpponent: Story = {
  args: {
    opponentVideoId: undefined,
    opponentSelector: (
      <OpponentSelector
        hasSelectableCandidates={false}
        isPinned={false}
        opponentVideoId={undefined}
        onBlur={() => {}}
        onChange={() => {}}
        onTogglePinned={() => {}}
        selectableWindow={[]}
        videoSnapshots={videoSnapshots}
      />
    )
  }
}
