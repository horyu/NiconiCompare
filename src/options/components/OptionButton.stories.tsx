import type { Meta, StoryObj } from "@storybook/react-vite"

import { OptionButton } from "./OptionButton"

const meta: Meta<typeof OptionButton> = {
  title: "OptionComponents/OptionButton",
  component: OptionButton,
  args: {
    children: "操作"
  }
}

export default meta
type Story = StoryObj<typeof OptionButton>

export const Default: Story = {}

export const Danger: Story = {
  args: { variant: "danger", children: "削除" }
}

export const Primary: Story = {
  args: { variant: "primary", children: "保存" }
}

export const Disabled: Story = {
  args: { disabled: true }
}
