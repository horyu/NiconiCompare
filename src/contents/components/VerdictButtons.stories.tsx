import type { Meta, StoryObj } from "@storybook/react-vite"

import { VerdictButtons } from "./VerdictButtons"

const meta: Meta<typeof VerdictButtons> = {
  component: VerdictButtons,
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
