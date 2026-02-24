import type { Meta, StoryObj } from "@storybook/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-full max-w-xl">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="rounded-xl border bg-card p-4">
        Account content
      </TabsContent>
      <TabsContent value="notifications" className="rounded-xl border bg-card p-4">
        Notifications content
      </TabsContent>
      <TabsContent value="security" className="rounded-xl border bg-card p-4">
        Security content
      </TabsContent>
    </Tabs>
  ),
};
