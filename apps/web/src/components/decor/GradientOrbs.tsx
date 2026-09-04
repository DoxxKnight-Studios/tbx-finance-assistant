/**
 * Atmospheric, blurred gradient blobs used behind the hero/welcome state.
 * Purely decorative - aria-hidden, fixed positioning, no interaction.
 */
export function GradientOrbs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        className="animate-orb-float absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-[60%] rounded-full opacity-40 blur-[110px] dark:opacity-25"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div
        className="animate-orb-float absolute top-32 right-[8%] h-[280px] w-[280px] rounded-full opacity-25 blur-[90px] dark:opacity-15"
        style={{
          background: "var(--brand-purple)",
          animationDelay: "-6s",
        }}
      />
    </div>
  );
}
