export function AstraLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="astra-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.95 0.05 240)" />
          <stop offset="100%" stopColor="oklch(0.65 0.24 260)" />
        </linearGradient>
      </defs>
      <path
        d="M20 3 L24 16 L37 20 L24 24 L20 37 L16 24 L3 20 L16 16 Z"
        fill="url(#astra-g)"
        style={{ filter: "drop-shadow(0 0 8px oklch(0.78 0.22 245 / 0.6))" }}
      />
    </svg>
  );
}
