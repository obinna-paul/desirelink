/**
 * Decorative fingerprint mark for the Spec Test landing page - nested broken rings
 * (an ellipse per ring, opened with stroke-dasharray rather than hand-plotted arc
 * paths) plus a small core swirl and an accent dot, echoing "you have a type - a
 * signature as individual as a fingerprint." Purely decorative (aria-hidden).
 */
export function FingerprintMark({ className }: { className?: string }) {
  const rings = [
    { rx: 18, ry: 24, rotate: -6, dash: "105 30" },
    { rx: 32, ry: 42, rotate: 12, dash: "185 55" },
    { rx: 46, ry: 60, rotate: -10, dash: "265 75" },
    { rx: 60, ry: 78, rotate: 8, dash: "345 95" },
    { rx: 74, ry: 96, rotate: -14, dash: "425 120" },
    { rx: 88, ry: 112, rotate: 5, dash: "500 140" },
  ];

  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {rings.map((ring, index) => (
          <ellipse
            key={index}
            cx="100"
            cy="125"
            rx={ring.rx}
            ry={ring.ry}
            transform={`rotate(${ring.rotate} 100 125)`}
            strokeDasharray={ring.dash}
            opacity={0.9 - index * 0.08}
          />
        ))}
        <path d="M90 116 Q100 106 111 115 Q120 123 109 130" opacity="0.9" />
      </g>
      <circle cx="120" cy="105" r="6" className="fill-neon-pink" />
    </svg>
  );
}
