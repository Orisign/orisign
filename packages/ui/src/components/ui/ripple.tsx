import * as React from "react";

import { cn } from "../../lib/utils";

type RippleEntry = {
  id: number;
  x: number;
  y: number;
  size: number;
};

export interface RippleProps extends React.ComponentPropsWithoutRef<"span"> {
  asChild?: boolean;
  disabled?: boolean;
  durationMs?: number;
}

const Ripple = React.forwardRef<HTMLElement, RippleProps>(
  (
    {
      asChild = false,
      disabled = false,
      durationMs = 550,
      className,
      onMouseDown,
      children,
      ...props
    },
    ref,
  ) => {
    const [ripples, setRipples] = React.useState<RippleEntry[]>([]);
    const rippleId = React.useRef(0);

    const handleMouseDown = (
      event: React.MouseEvent<HTMLElement>,
      childOnMouseDown?: (event: React.MouseEvent<HTMLElement>) => void,
    ) => {
      childOnMouseDown?.(event);
      onMouseDown?.(event);
      if (disabled || event.defaultPrevented) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const id = rippleId.current++;

      setRipples((prev) => [
        ...prev,
        {
          id,
          x: event.clientX - rect.left - size / 2,
          y: event.clientY - rect.top - size / 2,
          size,
        },
      ]);

      window.setTimeout(() => {
        setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      }, durationMs);
    };

    const rippleLayer = (
      <span aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="button-ripple"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
      </span>
    );

    if (asChild) {
      const child = React.Children.only(children);
      if (!React.isValidElement(child)) return null;

      const childProps = child.props as {
        className?: string;
        children?: React.ReactNode;
        onMouseDown?: (event: React.MouseEvent<HTMLElement>) => void;
      };

      return React.cloneElement(child, {
        className: cn("relative overflow-hidden", childProps.className, className),
        onMouseDown: (event: React.MouseEvent<HTMLElement>) =>
          handleMouseDown(event, childProps.onMouseDown),
        children: (
          <>
            <span className="relative z-[1]">{childProps.children}</span>
            {rippleLayer}
          </>
        ),
      });
    }

    return (
      <span
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        onMouseDown={(event) => handleMouseDown(event)}
        {...props}
      >
        <span className="relative z-[1]">{children}</span>
        {rippleLayer}
      </span>
    );
  },
);
Ripple.displayName = "Ripple";

export { Ripple };
