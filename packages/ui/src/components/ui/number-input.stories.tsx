import type { Meta, StoryObj } from "@storybook/react";
import { EmojiProvider } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";

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
    <EmojiProvider data={emojiData}>
      <div className="w-[360px]">
        <NumberInput {...args} />
      </div>
    </EmojiProvider>
  ),
};

export const WithInitialValue: Story = {
  render: () => (
    <EmojiProvider data={emojiData}>
      <div className="w-[360px]">
        <NumberInput defaultCountry="BY" defaultValue="297654321" />
      </div>
    </EmojiProvider>
  ),
};

export const Disabled: Story = {
  render: () => (
    <EmojiProvider data={emojiData}>
      <div className="w-[360px]">
        <NumberInput disabled defaultCountry="KZ" defaultValue="7001234567" />
      </div>
    </EmojiProvider>
  ),
};
