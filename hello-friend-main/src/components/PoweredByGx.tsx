export function PoweredByGx() {
  return (
    <div className="pointer-events-none fixed bottom-3 end-3 z-50 select-none">
      <a
        href="tel:01095777037"
        className="group pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-background/40 px-3 py-1.5 text-xs font-medium tracking-wide text-foreground/70 shadow-lg backdrop-blur-md transition hover:border-white/20 hover:text-foreground"
        title="Technical Support: 01095777037"
      >
        <span className="text-[10px] uppercase opacity-60">Powered by</span>
        <span
          className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text font-display text-sm font-bold tracking-wider text-transparent"
          style={{ filter: "drop-shadow(0 0 6px rgba(167,139,250,0.35))" }}
        >
          GX TEAM
        </span>
        <span className="hidden text-[10px] opacity-50 sm:inline">· 01095777037</span>
      </a>
    </div>
  );
}
