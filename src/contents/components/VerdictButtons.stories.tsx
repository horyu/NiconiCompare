import type { Meta, StoryObj } from "@storybook/react-vite"

import { VerdictButtons } from "./VerdictButtons"

const meta: Meta<typeof VerdictButtons> = {
  title: "Overlay/VerdictButtons",
  component: VerdictButtons,
  decorators: [
    (Story) => (
      <div className="bg-black/75 text-white text-sm p-3 rounded-lg shadow-lg max-w-[320px]">
        <Story />
      </div>
    )
  ],
  args: {
    canSubmit: true,
    lastVerdict: undefined,
    onSubmit: () => {}
  }
}

export default meta
type Story = StoryObj<typeof VerdictButtons>

export const Default: Story = {}

export const Selected: Story = {
  args: {
    lastVerdict: "better"
  }
}

export const Disabled: Story = {
  args: {
    canSubmit: false
  }
}
