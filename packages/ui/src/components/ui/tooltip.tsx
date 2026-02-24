"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../../lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground origin-[--radix-tooltip-content-transform-origin] [will-change:transform,opacity] motion-reduce:animate-none data-[state=delayed-open]:animate-[tooltip-in_120ms_cubic-bezier(0.2,0.9,0.2,1)] data-[state=instant-open]:animate-[tooltip-in_90ms_cubic-bezier(0.2,0.9,0.2,1)] data-[state=closed]:animate-[tooltip-out_80ms_cubic-bezier(0.4,0,1,1)]",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
