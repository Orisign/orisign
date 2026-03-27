"use client";

import { cn } from "@/lib/utils";
import { Ripple } from "@repo/ui";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import { memo, type ReactNode } from "react";
import type { RightSidebarContextAction } from "./types";

export const RightSidebarContextMenuContent = memo(function RightSidebarContextMenuContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "z-50 max-h-(--radix-context-menu-content-available-height) min-w-32 overflow-y-auto overflow-x-hidden rounded-md bg-popover px-1.5 py-1 text-popover-foreground origin-[--radix-context-menu-content-transform-origin] [will-change:transform,opacity] data-[state=open]:animate-[dropdown-in_180ms_cubic-bezier(.22,.8,.2,1)] data-[state=closed]:animate-[dropdown-out_140ms_cubic-bezier(.4,0,.2,1)]",
        )}
        collisionPadding={10}
      >
        {children}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  );
});

export const RightSidebarContextMenuItem = memo(function RightSidebarContextMenuItem({
  label,
  icon,
  onSelect,
  variant = "default",
}: Omit<RightSidebarContextAction, "key">) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-5 rounded-md px-3 py-1.5 text-sm font-semibold outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:stroke-[2.5px] [&_svg]:size-5 [&_svg]:shrink-0",
        variant === "default" && "focus:bg-accent focus:text-accent-foreground",
        variant === "destructive" &&
          "text-destructive [&_svg]:text-destructive focus:bg-destructive/10 focus:text-destructive",
      )}
      onSelect={onSelect}
    >
      {icon}
      {label}
    </ContextMenuPrimitive.Item>
  );
});

export function RightSidebarItemContextMenu({
  actions,
  children,
}: {
  actions: RightSidebarContextAction[];
  children: ReactNode;
}) {
  if (actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{children}</ContextMenuPrimitive.Trigger>
      <RightSidebarContextMenuContent>
        {actions.map((action) => (
          <RightSidebarContextMenuItem
            key={action.key}
            label={action.label}
            icon={action.icon}
            onSelect={action.onSelect}
            variant={action.variant}
          />
        ))}
      </RightSidebarContextMenuContent>
    </ContextMenuPrimitive.Root>
  );
}

export function RightSidebarInfoIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-7 [&_svg]:stroke-[1.95px]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RightSidebarInfoRow({
  icon,
  value,
  label,
  onClick,
  trailing,
  multiline = false,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
  multiline?: boolean;
}) {
  return (
    <Ripple asChild>
      <button
        type="button"
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-accent"
        onClick={onClick}
      >
        <RightSidebarInfoIcon>{icon}</RightSidebarInfoIcon>
        <span className="min-w-0 flex-1 pt-0.5">
          <span
            className={cn(
              "block text-[1rem] font-semibold text-foreground",
              multiline ? "line-clamp-3 whitespace-pre-wrap leading-5" : "truncate",
            )}
          >
            {value}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{label}</span>
        </span>
        {trailing}
      </button>
    </Ripple>
  );
}
