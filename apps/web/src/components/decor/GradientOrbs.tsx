import { motion, useReducedMotion } from "motion/react";

/**
 * Atmospheric, blurred gradient blobs behind the hero/welcome state. Each
 * orb drifts along its own organic path (independent x/y/scale keyframes)
 * rather than a single shared loop, so the motion reads as alive without
 * being distracting. Purely decorative - aria-hidden, no interaction.
 */
export function GradientOrbs() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-[60%] rounded-full opacity-30 blur-[110px] dark:opacity-20"
          style={{ background: "var(--brand-gradient)" }}
        />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-[60%] rounded-full opacity-40 blur-[110px] dark:opacity-25"
        style={{ background: "var(--brand-gradient)" }}
        animate={{
          x: ["0%", "6%", "-4%", "0%"],
          y: ["0%", "-8%", "4%", "0%"],
          scale: [1, 1.08, 0.97, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-32 right-[8%] h-[280px] w-[280px] rounded-full opacity-25 blur-[90px] dark:opacity-15"
        style={{ background: "var(--brand-purple)" }}
        animate={{
          x: ["0%", "-10%", "5%", "0%"],
          y: ["0%", "10%", "-6%", "0%"],
          scale: [1, 0.92, 1.06, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className="absolute bottom-0 left-[12%] h-[220px] w-[220px] rounded-full opacity-20 blur-[100px] dark:opacity-10"
        style={{ background: "var(--brand-orange)" }}
        animate={{
          x: ["0%", "8%", "-6%", "0%"],
          y: ["0%", "-6%", "8%", "0%"],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
    </div>
  );
}
