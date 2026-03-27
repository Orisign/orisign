"use client";

import { Button } from "@repo/ui";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Lock, Video } from "lucide-react";
import { IoMic, IoSend } from "react-icons/io5";
import { useEffect, useRef, useState } from "react";

const LOCK_THRESHOLD = -80;
const DRAG_TOP = -104;
const DRAG_BOTTOM = 18;

export interface AudioRecordButtonProps {
  disabled?: boolean;
  mode: "voice" | "ring";
  isRecording: boolean;
  isLocked: boolean;
  onPressStart: () => void;
  onTap?: () => void;
  onLockRecording: () => void;
  onSendRecording: () => void;
  onCancelGesture?: () => void;
}

export function AudioRecordButton({
  disabled = false,
  mode,
  isRecording,
  isLocked,
  onPressStart,
  onTap,
  onLockRecording,
  onSendRecording,
  onCancelGesture,
}: AudioRecordButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const springY = useSpring(y, {
    stiffness: 300,
    damping: 26,
    mass: 0.45,
  });
  const visualOffsetY = useTransform(() => springY.get() - y.get());
  const [isPressed, setIsPressed] = useState(false);
  const [showLockUI, setShowLockUI] = useState(false);
  const didDragRef = useRef(false);
  const didFinalizeRef = useRef(false);

  useEffect(() => {
    if (!showLockUI && !isPressed) {
      y.set(0);
    }
  }, [isPressed, showLockUI, y]);

  function resetGestureVisuals() {
    didDragRef.current = false;
    didFinalizeRef.current = false;
    setIsPressed(false);
    setShowLockUI(false);

    if (prefersReducedMotion) {
      y.set(0);
      return;
    }

    void animate(y, 0, {
      type: "spring",
      stiffness: 300,
      damping: 20,
    });
  }

  function finalizeGesture() {
    if (didFinalizeRef.current) {
      return;
    }

    didFinalizeRef.current = true;
    const currentY = y.get();
    const shouldLock = currentY <= LOCK_THRESHOLD;

    if (isRecording && shouldLock) {
      onLockRecording();
    } else if (isRecording) {
      onSendRecording();
    } else {
      onTap?.();
    }

    resetGestureVisuals();
  }

  if (isLocked) {
    return (
      <motion.div
        initial={false}
        animate={{ scale: 1, opacity: 1 }}
        className="shrink-0 self-center"
      >
        <Button
          type="button"
          className="size-12 shrink-0 rounded-full shadow-none [&_svg]:size-6"
          onClick={onSendRecording}
          disabled={disabled}
        >
          <IoSend className="size-5" />
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="relative flex size-12 shrink-0 items-end justify-center self-center overflow-visible">
      <motion.div
        initial={false}
        animate={showLockUI ? { opacity: 1 } : { opacity: 0 }}
        transition={prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.12, ease: "easeOut" }}
        className="pointer-events-none absolute bottom-0 left-[58%] flex h-[152px] w-[64px] -translate-x-1/2 items-start justify-center rounded-full bg-muted-foreground/90"
      >
        <div className="mt-5 flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          <Lock className="size-4" strokeWidth={2.2} />
          <span>Lock</span>
        </div>
      </motion.div>

      <motion.div
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragElastic={0}
        dragMomentum={false}
        dragConstraints={{ top: DRAG_TOP, bottom: DRAG_BOTTOM }}
        style={{ y, touchAction: "none" }}
        onDragStart={() => {
          didDragRef.current = true;
        }}
        onDragEnd={() => {
          finalizeGesture();
        }}
        className="absolute bottom-0 left-1/2 z-[1] -translate-x-1/2"
      >
        <motion.div
          style={{ y: visualOffsetY }}
          animate={isPressed ? { scale: 0.95 } : { scale: 1 }}
          transition={prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 340, damping: 26 }}
        >
          <Button
            type="button"
            className="size-12 rounded-full bg-primary text-primary-foreground shadow-none hover:bg-primary/95 [&_svg]:size-6"
            disabled={disabled}
            onPointerDown={(event) => {
              if (disabled) {
                return;
              }

              setIsPressed(true);
              setShowLockUI(true);
              didFinalizeRef.current = false;
              didDragRef.current = false;
              y.set(0);
              onPressStart();
              dragControls.start(event, { snapToCursor: false });
            }}
            onPointerUp={() => {
              if (!didDragRef.current) {
                finalizeGesture();
              }
            }}
            onPointerCancel={() => {
              onCancelGesture?.();
              resetGestureVisuals();
            }}
          >
            {mode === "ring" ? <Video className="size-5" /> : <IoMic className="size-5" />}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
