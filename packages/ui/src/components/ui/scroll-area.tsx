"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "../../lib/utils";

interface ScrollAreaProps
  extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  viewportRef?: React.Ref<HTMLDivElement>;
  viewportId?: string;
  viewportClassName?: string;
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
}

function ScrollArea({
  className,
  children,
  viewportRef,
  viewportId,
  viewportClassName,
  onViewportScroll,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        id={viewportId}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] [&>div]:min-h-full",
          viewportClassName,
        )}
        onScroll={onViewportScroll}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "absolute z-20 flex touch-none select-none bg-transparent transition-colors",
        orientation === "vertical" && "right-0 top-0 h-full w-1.5",
        orientation === "horizontal" && "bottom-0 left-0 h-1.5 w-full flex-col",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-muted-foreground"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
