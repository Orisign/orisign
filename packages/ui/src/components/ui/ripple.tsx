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
      onPointerDownCapture,
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
    };

    const spawnRipple = (
      target: HTMLElement,
      clientX: number,
      clientY: number,
    ) => {
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const id = rippleId.current++;

      setRipples((prev) => [
        ...prev,
        {
          id,
          x: clientX - rect.left - size / 2,
          y: clientY - rect.top - size / 2,
          size,
        },
      ]);

      window.setTimeout(() => {
        setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      }, durationMs);
    };

    const handlePointerDownCapture = (
      event: React.PointerEvent<HTMLElement>,
      childOnPointerDownCapture?: (
        event: React.PointerEvent<HTMLElement>,
      ) => void,
    ) => {
      childOnPointerDownCapture?.(event);
      onPointerDownCapture?.(event);
      if (disabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      spawnRipple(event.currentTarget, event.clientX, event.clientY);
    };

    const rippleLayer = (
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[2]">
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
      const childElement = child as React.ReactElement<any>;

      const childProps = childElement.props as {
        className?: string;
        children?: React.ReactNode;
        onMouseDown?: (event: React.MouseEvent<HTMLElement>) => void;
        onPointerDownCapture?: (
          event: React.PointerEvent<HTMLElement>,
        ) => void;
      };

      return React.cloneElement(childElement, {
        className: cn("relative isolate overflow-hidden", childProps.className, className),
        onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) =>
          handlePointerDownCapture(event, childProps.onPointerDownCapture),
        onMouseDown: (event: React.MouseEvent<HTMLElement>) =>
          handleMouseDown(event, childProps.onMouseDown),
        children: (
          <>
            {childProps.children}
            {rippleLayer}
          </>
        ),
      });
    }

    return (
      <span
        ref={ref}
        className={cn("relative block isolate overflow-hidden", className)}
        {...props}
        onPointerDownCapture={(event) => handlePointerDownCapture(event)}
        onMouseDown={(event) => handleMouseDown(event)}
      >
        {children}
        {rippleLayer}
      </span>
    );
  },
);
Ripple.displayName = "Ripple";

export { Ripple };
