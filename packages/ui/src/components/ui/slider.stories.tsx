import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Slider } from "./slider";

const meta: Meta<typeof Slider> = {
  title: "Components/Slider",
  component: Slider,
  tags: ["autodocs"],
  args: {
    min: 0,
    max: 100,
    step: 1,
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    defaultValue: [40],
  },
  render: (args) => (
    <div className="w-full max-w-sm">
      <Slider {...args} />
    </div>
  ),
};

export const WithValue: Story = {
  render: (args) => {
    const [value, setValue] = React.useState([55]);

    return (
      <div className="w-full max-w-sm space-y-3">
        <div className="text-sm font-medium">Value: {value[0]}</div>
        <Slider {...args} value={value} onValueChange={setValue} />
      </div>
    );
  },
};

export const Range: Story = {
  args: {
    min: 0,
    max: 100,
    step: 1,
  },
  render: (args) => {
    const [value, setValue] = React.useState([20, 75]);

    return (
      <div className="w-full max-w-sm space-y-3">
        <div className="text-sm font-medium">
          Range: {value[0]} - {value[1]}
        </div>
        <Slider {...args} value={value} onValueChange={setValue} />
      </div>
    );
  },
};
