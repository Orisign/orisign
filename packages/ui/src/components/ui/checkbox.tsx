"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "../../lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group peer relative isolate grid size-5 shrink-0 cursor-pointer place-content-center overflow-hidden rounded-sm border border-primary bg-accent text-primary-foreground transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 rounded-full bg-primary transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=unchecked]:scale-[0] group-data-[state=checked]:scale-[1.7] group-data-[state=checked]:opacity-100"
    />
    <CheckboxPrimitive.Indicator
      forceMount
      className={cn(
        "relative z-10 grid place-content-center text-current transition-opacity duration-150 data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-0"
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        aria-hidden
      >
        <path
          d="M3.5 8.5L6.8 11.5L12.5 5.5"
          className="checkbox-checkmark-path"
        />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
