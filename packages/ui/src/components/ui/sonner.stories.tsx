import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { toast, Toaster } from "./sonner";

const meta: Meta<typeof Toaster> = {
  title: "Components/Sonner",
  component: Toaster,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const Playground: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button
        onClick={() =>
          toast.success("Saved successfully", {
            description: "All changes are synced.",
          })
        }
      >
        Success
      </Button>
      <Button
        onClick={() =>
          toast.error("Action failed", { description: "Please try again." })
        }
        variant="destructive"
      >
        Error
      </Button>
      <Button
        onClick={() =>
          toast.info("Heads up", { description: "New update available." })
        }
        variant="outline"
      >
        Info
      </Button>
      <Button
        onClick={() => toast("Focus mode enabled", { description: "Session started for 45 minutes." })}
        variant="secondary"
      >
        Default
      </Button>
      <Button
        onClick={() => {
          const loadingId = toast.loading("Uploading...");
          setTimeout(() => {
            toast.dismiss(loadingId);
            toast.success("Upload completed");
          }, 1400);
        }}
        variant="secondary"
      >
        Promise
      </Button>
    </div>
  ),
};
