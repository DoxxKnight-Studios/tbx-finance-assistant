import { motion, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `animated` drives the Gemini-style "thinking" look: a slowly rotating
 * conic gradient glow behind the mark plus a soft breathing scale, instead
 * of a static icon. Purely decorative - no effect on when a reply resolves.
 */
export function AssistantAvatar({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const play = animated && !prefersReducedMotion;

  return (
    <div className={cn("relative flex size-9 shrink-0 items-center justify-center", className)}>
      {play && (
        <motion.div
          aria-hidden="true"
          className="absolute -inset-1.5 rounded-full opacity-70 blur-[6px]"
          style={{ background: "var(--brand-gradient)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
        />
      )}
      <motion.div
        className="relative flex size-9 items-center justify-center rounded-full text-white shadow-brand-glow"
        style={{ background: "var(--brand-gradient)" }}
        animate={play ? { scale: [1, 1.08, 1] } : undefined}
        transition={play ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <Sparkles className="size-4" strokeWidth={2.25} />
      </motion.div>
    </div>
  );
}
