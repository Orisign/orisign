import * as React from "react";

import { cn } from "../../lib/utils";

export interface RippleProps extends React.ComponentPropsWithoutRef<"span"> {
  asChild?: boolean;
  disabled?: boolean;
  durationMs?: number;
}

const MAX_ACTIVE_RIPPLES = 3;

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
    const rippleLayerRef = React.useRef<HTMLSpanElement | null>(null);
    const reducedMotionRef = React.useRef(false);

    React.useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }

      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const syncReducedMotion = () => {
        reducedMotionRef.current = mediaQuery.matches;
      };

      syncReducedMotion();
      mediaQuery.addEventListener("change", syncReducedMotion);
      return () => mediaQuery.removeEventListener("change", syncReducedMotion);
    }, []);

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
      if (disabled || reducedMotionRef.current) return;

      const layer = rippleLayerRef.current;
      if (!layer) return;

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const ripple = document.createElement("span");
      ripple.className = "button-ripple";
      ripple.style.left = `${clientX - rect.left - size / 2}px`;
      ripple.style.top = `${clientY - rect.top - size / 2}px`;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.animationDuration = `${durationMs}ms`;
      layer.append(ripple);

      while (layer.childElementCount > MAX_ACTIVE_RIPPLES) {
        layer.firstElementChild?.remove();
      }

      ripple.addEventListener(
        "animationend",
        () => {
          ripple.remove();
        },
        { once: true },
      );
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
      <span
        ref={rippleLayerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      />
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
