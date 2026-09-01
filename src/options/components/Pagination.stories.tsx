import type { Meta, StoryObj } from "@storybook/react-vite"

import { Pagination } from "./Pagination"

const meta: Meta<typeof Pagination> = {
  title: "OptionComponents/Pagination",
  component: Pagination,
  decorators: [
    (Story) => (
      <div className="max-w-[360px] rounded-lg border border-slate-200 bg-white p-4">
        <Story />
      </div>
    )
  ],
  args: {
    current: 3,
    total: 10,
    onChange: () => {}
  }
}

export default meta
type Story = StoryObj<typeof Pagination>

export const Default: Story = {}

export const FirstPage: Story = {
  args: {
    current: 1
  }
}

export const LastPage: Story = {
  args: {
    current: 10
  }
}

export const SinglePage: Story = {
  args: {
    current: 1,
    total: 1
  }
}
