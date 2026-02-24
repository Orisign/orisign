import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "./field";
import { Ripple } from "./ripple";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const WithFieldGroup: Story = {
  render: () => (
    <FieldGroup className="w-full max-w-md">
      <Field orientation="horizontal">
        <Checkbox id="notify-email" defaultChecked />
        <FieldContent>
          <FieldLabel htmlFor="notify-email">
            <FieldTitle>Email notifications</FieldTitle>
          </FieldLabel>
          <FieldDescription>
            Receive updates about mentions and direct messages.
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <Checkbox id="notify-push" />
        <FieldContent>
          <FieldLabel htmlFor="notify-push">
            <FieldTitle>Push notifications</FieldTitle>
          </FieldLabel>
          <FieldDescription>
            Show real-time notifications on this device.
          </FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  ),
};

export const WithRippleWrapper: Story = {
  render: () => (
    <div className="w-fit">
      <Ripple asChild className="w-full rounded-xl">
        <label
          htmlFor="checkbox-ripple"
          className="flex flex-row w-full cursor-pointer items-center gap-3 rounded-xl bg-accent px-5 py-4 [&>span:first-child]:inline-flex [&>span:first-child]:items-center [&>span:first-child]:gap-3 [&>span:first-child]:whitespace-nowrap"
        >
          <Checkbox id="checkbox-ripple" defaultChecked />
          <span className="text-sm font-medium select-none">
            Принимаю <span className="text-blue-500">политику конфиденциальности</span> <strong>Orisign</strong>
          </span>
        </label>
      </Ripple>
    </div>
  ),
};
