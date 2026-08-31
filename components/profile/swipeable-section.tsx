"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode, type TouchEvent } from "react";

const SWIPE_THRESHOLD_PX = 50;

export function SwipeableSection({
  hrefs,
  currentIndex,
  children,
}: {
  hrefs: string[];
  currentIndex: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function onTouchStart(event: TouchEvent) {
    startX.current = event.touches[0]?.clientX ?? null;
    startY.current = event.touches[0]?.clientY ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    const startXValue = startX.current;
    const startYValue = startY.current;
    startX.current = null;
    startY.current = null;
    if (startXValue === null || startYValue === null) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - startXValue;
    const deltaY = touch.clientY - startYValue;
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) < Math.abs(deltaY) * 1.5
    )
      return;

    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= hrefs.length) return;
    router.push(hrefs[nextIndex], { scroll: false });
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  );
}
