import * as React from "react";

import { cn } from "../../lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, wrapperClassName, leftSlot, rightSlot, type, ...props },
    ref,
  ) => {
    const input = (
      <input
        type={type}
        className={cn(
          "h-full w-full border-0 bg-transparent text-[15px] placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    if (leftSlot || rightSlot) {
      return (
        <div
          className={cn(
            "group flex h-11 w-full items-center gap-2 rounded-xl border-2 border-border bg-secondary/80 px-3 text-foreground transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background",
            wrapperClassName,
          )}
        >
          {leftSlot ? (
            <span className="shrink-0 text-muted-foreground">{leftSlot}</span>
          ) : null}
          {input}
          {rightSlot ? (
            <span className="shrink-0 text-muted-foreground">{rightSlot}</span>
          ) : null}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "h-11 w-full rounded-xl border-2 border-border/60 bg-secondary/80 px-4 text-[15px] text-foreground placeholder:text-muted-foreground transition-all duration-200 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
