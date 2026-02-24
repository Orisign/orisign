"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "../../lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "group peer relative isolate size-5 shrink-0 cursor-pointer overflow-hidden rounded-full border border-primary bg-accent text-primary-foreground transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-full bg-primary transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=unchecked]:scale-0 group-data-[state=checked]:scale-[1.7]"
      />
      <RadioGroupPrimitive.Indicator
        forceMount
        className="relative z-10 flex items-center justify-center transition-opacity duration-150 data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-0"
      >
        <span className="size-2 rounded-full bg-current transition-transform duration-300 ease-out data-[state=checked]:scale-100 data-[state=unchecked]:scale-50" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
