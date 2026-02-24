import { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Paperclip, Smile } from "lucide-react";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Message",
  },
};

export const WithIcons: Story = {
  args: {
    leftSlot: <Smile size={23} />,
    rightSlot: <Paperclip size={23} />,
    placeholder: "Сообщение",
  },
};
