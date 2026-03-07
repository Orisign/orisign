import * as React from "react";

import { cn } from "@/lib/utils";

const SidebarPage = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-page"
    className={cn("relative flex w-full min-h-full flex-col gap-6 bg-muted/30", className)}
    {...props}
  />
));
SidebarPage.displayName = "SidebarPage";

function SidebarPageHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-page-header"
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between bg-muted/30 px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

function SidebarPageTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      data-slot="sidebar-page-title"
      className={cn("text-xl font-bold", className)}
      {...props}
    />
  );
}

function SidebarPageContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-page-content"
      className={cn("flex w-full flex-col gap-1.5 px-4", className)}
      {...props}
    />
  );
}

function SidebarPageSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-page-separator"
      className={cn("h-6 w-full bg-accent", className)}
      {...props}
    />
  );
}

export {
  SidebarPage,
  SidebarPageHeader,
  SidebarPageTitle,
  SidebarPageContent,
  SidebarPageSeparator,
};
