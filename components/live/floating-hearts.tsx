"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

type Particle = { id: number; x: number; y: number; hue: number };

const DOUBLE_TAP_WINDOW_MS = 300;
const PARTICLE_LIFETIME_MS = 1600;
const HEART_COLORS = ["text-neon-pink", "text-neon-cyan", "text-primary"];

/**
 * Full-bleed overlay that turns a double-tap anywhere on the video into a
 * burst of floating hearts, and also renders bursts for OTHER viewers'
 * reactions (via `remoteReactionTick`, bumped once per incoming Pusher event).
 * Sits under the header/controls — those opt back into pointer-events
 * individually so taps still reach this layer everywhere else.
 */
export function FloatingHeartsLayer({
  onDoubleTap,
  remoteReactionTick,
}: {
  onDoubleTap: () => void;
  remoteReactionTick: number;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastTapRef = useRef(0);
  const idRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function spawnAt(x: number, y: number) {
    const batch: Particle[] = Array.from({ length: 4 }, () => ({
      id: idRef.current++,
      x: x + (Math.random() * 48 - 24),
      y,
      hue: Math.floor(Math.random() * HEART_COLORS.length),
    }));
    setParticles((prev) => [...prev, ...batch]);
    batch.forEach((particle) => {
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== particle.id));
      }, PARTICLE_LIFETIME_MS);
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS) {
      spawnAt(x, y);
      onDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  useEffect(() => {
    if (remoteReactionTick === 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    spawnAt(rect.width / 2 + (Math.random() * 120 - 60), rect.height * 0.55);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per incoming reaction, not per render
  }, [remoteReactionTick]);

  return (
    <div ref={containerRef} className="absolute inset-0" onPointerDown={handlePointerDown}>
      {particles.map((particle) => (
        <Heart
          key={particle.id}
          className={`pointer-events-none absolute h-8 w-8 animate-float-heart motion-reduce:hidden ${HEART_COLORS[particle.hue]}`}
          style={{ left: particle.x, top: particle.y }}
          fill="currentColor"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
