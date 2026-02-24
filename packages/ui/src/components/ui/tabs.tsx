"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion } from "motion/react"

import { cn } from "../../lib/utils"
import { Ripple } from "./ripple"

type TabsMotionContextValue = {
  direction: number
  setDirection: React.Dispatch<React.SetStateAction<number>>
}

const TabsMotionContext = React.createContext<TabsMotionContextValue>({
  direction: 1,
  setDirection: () => {},
})

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ children, ...props }, ref) => {
  const [direction, setDirection] = React.useState(1)

  return (
    <TabsMotionContext.Provider value={{ direction, setDirection }}>
      <TabsPrimitive.Root ref={ref} {...props}>
        {children}
      </TabsPrimitive.Root>
    </TabsMotionContext.Provider>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = React.useState<{ left: number; width: number } | null>(null)
  const previousIndexRef = React.useRef<number | null>(null)
  const { setDirection } = React.useContext(TabsMotionContext)

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

  const updateIndicator = React.useCallback(() => {
    const list = listRef.current
    if (!list) return

    const activeTrigger = list.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]'
    )
    if (!activeTrigger) return

    const listRect = list.getBoundingClientRect()
    const triggerRect = activeTrigger.getBoundingClientRect()
    setIndicator({
      left: triggerRect.left - listRect.left,
      width: triggerRect.width,
    })

    const triggers = Array.from(
      list.querySelectorAll<HTMLElement>('[role="tab"]')
    )
    const nextIndex = triggers.findIndex((trigger) => trigger === activeTrigger)
    const previousIndex = previousIndexRef.current

    if (previousIndex !== null && nextIndex !== -1 && nextIndex !== previousIndex) {
      setDirection(nextIndex > previousIndex ? 1 : -1)
    }
    if (nextIndex !== -1) {
      previousIndexRef.current = nextIndex
    }
  }, [])

  React.useEffect(() => {
    updateIndicator()
    const list = listRef.current
    if (!list) return

    const mutationObserver = new MutationObserver(updateIndicator)
    mutationObserver.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    })

    const resizeObserver = new ResizeObserver(updateIndicator)
    resizeObserver.observe(list)

    window.addEventListener("resize", updateIndicator)
    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateIndicator)
    }
  }, [updateIndicator, children])

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "relative inline-flex items-end gap-4 text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      {indicator ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute bottom-[-2px] h-1.5 rounded-full bg-primary"
          initial={false}
          animate={{ left: indicator.left, width: indicator.width }}
          transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.7 }}
        />
      ) : null}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <Ripple asChild className="rounded-t-xl">
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-t-xl px-6 py-3.5 text-sm font-semibold ring-offset-background transition-colors duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground",
        className
      )}
      {...props}
    />
  </Ripple>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, style, ...props }, ref) => {
  const { direction } = React.useContext(TabsMotionContext)

  return (
    <TabsPrimitive.Content
      ref={ref}
      style={
        {
          ...style,
          "--tabs-content-shift": `${direction * 24}px`,
        } as React.CSSProperties
      }
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none motion-reduce:animate-none data-[state=active]:animate-[tabs-content-in_900ms_cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
