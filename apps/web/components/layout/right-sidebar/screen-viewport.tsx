"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RightSidebarScreen } from "./types";

interface RightSidebarScreenViewportProps {
  current: RightSidebarScreen;
  direction: 1 | -1;
  shouldSlide: boolean;
  scenes: Record<RightSidebarScreen, ReactNode>;
}

interface RightSidebarScene {
  id: number;
  key: RightSidebarScreen;
}

interface RightSidebarSceneTransition {
  id: string;
  from: RightSidebarScene;
  to: RightSidebarScene;
  direction: 1 | -1;
}

const SIDEBAR_NAV_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const SIDEBAR_NAV_FORWARD_DURATION_MS = 300;
const SIDEBAR_NAV_BACK_DURATION_MS = 250;
const SIDEBAR_NAV_PARALLAX = 0.25;

function resetSidebarLayerStyles(layer: HTMLDivElement) {
  layer.style.transition = "";
  layer.style.transform = "translate3d(0, 0, 0)";
  layer.style.filter = "";
  layer.style.willChange = "";
}

export function RightSidebarScreenViewport({
  current,
  direction,
  shouldSlide,
  scenes,
}: RightSidebarScreenViewportProps) {
  const hasMountedRef = useRef(false);
  const sceneCounterRef = useRef(0);
  const baseLayerRef = useRef<HTMLDivElement | null>(null);
  const incomingLayerRef = useRef<HTMLDivElement | null>(null);
  const [displayedScene, setDisplayedScene] = useState<RightSidebarScene>(() => ({
    id: 0,
    key: current,
  }));
  const [transition, setTransition] = useState<RightSidebarSceneTransition | null>(
    null,
  );

  const displayedSceneRef = useRef(displayedScene);
  const transitionRef = useRef(transition);

  const scheduleStateUpdate = (updater: () => void) => {
    queueMicrotask(updater);
  };

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  useLayoutEffect(() => {
    displayedSceneRef.current = displayedScene;
    transitionRef.current = transition;
  }, [displayedScene, transition]);

  useLayoutEffect(() => {
    const activeScene = displayedSceneRef.current;
    const activeTransition = transitionRef.current;

    if (activeScene.key === current) {
      return;
    }

    if (activeTransition?.to.key === current) {
      return;
    }

    const nextScene: RightSidebarScene = {
      id: sceneCounterRef.current + 1,
      key: current,
    };
    sceneCounterRef.current = nextScene.id;

    if (!shouldSlide || !hasMountedRef.current) {
      scheduleStateUpdate(() => {
        setTransition(null);
        setDisplayedScene(nextScene);
      });
      return;
    }

    scheduleStateUpdate(() => {
      setTransition({
        id: `${activeScene.id}:${nextScene.id}:${direction}`,
        from: activeScene,
        to: nextScene,
        direction,
      });
    });
  }, [current, direction, shouldSlide]);

  useLayoutEffect(() => {
    if (!transition) {
      return;
    }

    const baseLayer = baseLayerRef.current;
    const incomingLayer = incomingLayerRef.current;

    if (!baseLayer || !incomingLayer) {
      scheduleStateUpdate(() => {
        setDisplayedScene(transition.to);
        setTransition(null);
      });
      return;
    }

    const width = Math.max(baseLayer.getBoundingClientRect().width, 1);
    const isForward = transition.direction === 1;
    const duration = isForward
      ? SIDEBAR_NAV_FORWARD_DURATION_MS
      : SIDEBAR_NAV_BACK_DURATION_MS;
    const transitionValue = `transform ${duration}ms ${SIDEBAR_NAV_EASING}, filter ${duration}ms ${SIDEBAR_NAV_EASING}`;

    resetSidebarLayerStyles(baseLayer);
    resetSidebarLayerStyles(incomingLayer);

    baseLayer.style.transition = "none";
    incomingLayer.style.transition = "none";

    baseLayer.style.transform = "translate3d(0, 0, 0)";
    baseLayer.style.filter = isForward ? "brightness(0.8)" : "";

    incomingLayer.style.transform = isForward
      ? `translate3d(${width}px, 0, 0)`
      : `translate3d(${-width * SIDEBAR_NAV_PARALLAX}px, 0, 0)`;
    incomingLayer.style.filter = isForward ? "" : "brightness(0.8)";

    baseLayer.style.willChange = "transform, filter";
    incomingLayer.style.willChange = "transform, filter";
    void incomingLayer.offsetHeight;

    baseLayer.style.transition = transitionValue;
    incomingLayer.style.transition = transitionValue;

    baseLayer.style.transform = isForward
      ? `translate3d(${-width * SIDEBAR_NAV_PARALLAX}px, 0, 0)`
      : `translate3d(${width}px, 0, 0)`;
    incomingLayer.style.transform = "translate3d(0, 0, 0)";
    incomingLayer.style.filter = "";

    const finishTransition = () => {
      setTransition((prevTransition) => {
        if (!prevTransition || prevTransition.id !== transition.id) {
          return prevTransition;
        }

        setDisplayedScene(prevTransition.to);
        return null;
      });
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (
        event.target !== incomingLayer ||
        event.propertyName !== "transform"
      ) {
        return;
      }

      finishTransition();
    };

    const timeoutId = window.setTimeout(finishTransition, duration + 72);
    incomingLayer.addEventListener("transitionend", onTransitionEnd);

    return () => {
      window.clearTimeout(timeoutId);
      incomingLayer.removeEventListener("transitionend", onTransitionEnd);
      resetSidebarLayerStyles(baseLayer);
      resetSidebarLayerStyles(incomingLayer);
    };
  }, [transition]);

  const baseScene = transition ? transition.from : displayedScene;
  const incomingScene = transition ? transition.to : null;

  return (
    <div className="relative h-full min-w-0 overflow-hidden [contain:layout_paint]">
      <div
        ref={baseLayerRef}
        className="absolute inset-0 flex min-h-0 min-w-0 flex-col bg-sidebar transform-gpu"
        style={{
          backfaceVisibility: "hidden",
          pointerEvents: transition ? "none" : "auto",
        }}
        aria-hidden={transition ? true : undefined}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {scenes[baseScene.key]}
        </div>
      </div>

      {incomingScene ? (
        <div
          ref={incomingLayerRef}
          className="absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col bg-sidebar transform-gpu"
          style={{
            backfaceVisibility: "hidden",
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {scenes[incomingScene.key]}
          </div>
        </div>
      ) : null}
    </div>
  );
}
