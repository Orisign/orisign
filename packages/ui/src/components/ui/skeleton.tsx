import * as React from "react"

import { cn } from "../../lib/utils"

type SkeletonGroupContextValue = {
  isGrouped: boolean
}

const SkeletonGroupContext = React.createContext<SkeletonGroupContextValue | null>(
  null
)

type SkeletonGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  durationMs?: number
}

function SkeletonGroup({
  className,
  durationMs = 2200,
  style,
  children,
  ...props
}: SkeletonGroupProps) {
  const contextValue = React.useMemo(
    () => ({
      isGrouped: true,
    }),
    []
  )

  return (
    <SkeletonGroupContext.Provider value={contextValue}>
      <div
        className={cn("skeleton-group", className)}
        style={
          {
            ...style,
            "--skeleton-group-duration": `${durationMs}ms`,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </SkeletonGroupContext.Provider>
  )
}

function Skeleton({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const groupContext = React.useContext(SkeletonGroupContext)

  return (
    <div
      className={cn(
        "rounded-md bg-muted",
        groupContext?.isGrouped ? "skeleton-shimmer-grouped" : "skeleton-shimmer",
        className
      )}
      style={style}
      {...props}
    />
  )
}

export { Skeleton, SkeletonGroup }
