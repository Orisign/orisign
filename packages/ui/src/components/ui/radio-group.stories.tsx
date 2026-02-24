import type { Meta, StoryObj } from "@storybook/react";

import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "./field";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Ripple } from "./ripple";

const meta: Meta<typeof RadioGroup> = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="email" className="w-full max-w-sm">
      <label className="flex items-center gap-3">
        <RadioGroupItem id="radio-email" value="email" />
        <span className="text-sm font-medium">Email</span>
      </label>
      <label className="flex items-center gap-3">
        <RadioGroupItem id="radio-push" value="push" />
        <span className="text-sm font-medium">Push</span>
      </label>
    </RadioGroup>
  ),
};

export const WithFieldGroup: Story = {
  render: () => (
    <RadioGroup defaultValue="email" className="w-full max-w-md">
      <FieldGroup>
        <Field orientation="horizontal">
          <RadioGroupItem id="radio-field-email" value="email" />
          <FieldContent>
            <FieldLabel htmlFor="radio-field-email">
              <FieldTitle>Email notifications</FieldTitle>
            </FieldLabel>
            <FieldDescription>
              Receive updates about mentions and direct messages.
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field orientation="horizontal">
          <RadioGroupItem id="radio-field-push" value="push" />
          <FieldContent>
            <FieldLabel htmlFor="radio-field-push">
              <FieldTitle>Push notifications</FieldTitle>
            </FieldLabel>
            <FieldDescription>
              Show real-time notifications on this device.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </RadioGroup>
  ),
};

export const WithRippleWrapper: Story = {
  render: () => (
    <RadioGroup defaultValue="weekly" className="w-full max-w-sm">
      <Ripple asChild className="w-full rounded-xl">
        <label
          htmlFor="radio-weekly"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-accent px-5 py-4 [&>span:first-child]:inline-flex [&>span:first-child]:items-center [&>span:first-child]:gap-3 [&>span:first-child]:whitespace-nowrap"
        >
          <RadioGroupItem id="radio-weekly" value="weekly" />
          <span className="text-sm font-medium select-none">Weekly summary</span>
        </label>
      </Ripple>

      <Ripple asChild className="w-full rounded-xl">
        <label
          htmlFor="radio-instant"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-accent px-5 py-4 [&>span:first-child]:inline-flex [&>span:first-child]:items-center [&>span:first-child]:gap-3 [&>span:first-child]:whitespace-nowrap"
        >
          <RadioGroupItem id="radio-instant" value="instant" />
          <span className="text-sm font-medium select-none">Instant updates</span>
        </label>
      </Ripple>
    </RadioGroup>
  ),
};
