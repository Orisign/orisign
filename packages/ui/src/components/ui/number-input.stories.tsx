import type { Meta, StoryObj } from "@storybook/react";

import { NumberInput } from "./number-input";

const meta: Meta<typeof NumberInput> = {
  id: "components-nuberinput",
  title: "Components/NumberInput",
  component: NumberInput,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof NumberInput>;

export const Default: Story = {
  args: {
    defaultCountry: "RU",
  },
  render: (args) => (
    <div className="w-[360px]">
      <NumberInput {...args} />
    </div>
  ),
};

export const WithInitialValue: Story = {
  render: () => (
    <div className="w-[360px]">
      <NumberInput defaultCountry="BY" defaultValue="297654321" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[360px]">
      <NumberInput disabled defaultCountry="KZ" defaultValue="7001234567" />
    </div>
  ),
};
