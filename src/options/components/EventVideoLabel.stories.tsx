import type { Meta, StoryObj } from "@storybook/react-vite"

import type { VideoSnapshot } from "../../lib/types"
import { EventVideoLabel } from "./EventVideoLabel"

const sampleVideo: VideoSnapshot = {
  videoId: "sm1234567",
  title: "テスト動画タイトル",
  authorUrl: "https://www.nicovideo.jp/user/1",
  thumbnailUrls: [],
  capturedAt: Date.now()
}

const meta: Meta<typeof EventVideoLabel> = {
  title: "OptionComponents/EventVideoLabel",
  component: EventVideoLabel,
  decorators: [
    (Story) => (
      <div className="max-w-[360px] rounded-lg border border-slate-200 bg-white p-4">
        <Story />
      </div>
    )
  ],
  args: {
    videoId: "sm1234567",
    video: sampleVideo,
    authorName: "投稿者名",
    showThumbnail: true
  }
}

export default meta
type Story = StoryObj<typeof EventVideoLabel>

export const Default: Story = {}

export const WithoutThumbnail: Story = {
  args: {
    showThumbnail: false
  }
}

export const MissingData: Story = {
  args: {
    video: undefined,
    authorName: undefined
  }
}
