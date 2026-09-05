import { ArrowUp } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Circular send button adapted from MagicUI's ShimmerButton: a spinning
 * conic-gradient spark sits behind a solid backdrop inset by a hairline,
 * so it peeks out only as a thin spinning light ring at the very edge -
 * subtle rather than a busy sparkle. Runs continuously but very slowly;
 * a brand-gradient fill underneath keeps the button legible even where
 * the spark isn't visible.
 */
export function SendButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Send message"
      disabled={disabled}
      onClick={onClick}
      style={{ "--speed": "3.5s", "--cut": "2px" } as CSSProperties}
      className={cn(
        "group relative z-0 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white",
        "transform-gpu transition-transform duration-200 active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="@container-size pointer-events-none absolute inset-0 -z-30 overflow-visible blur-[1.5px]">
        <div className="animate-shimmer-slide absolute inset-0 aspect-square h-[100cqh]">
          <div className="animate-spin-around absolute -inset-full [background:conic-gradient(from_calc(270deg-45deg),transparent_0,#fff_45deg,transparent_90deg)]" />
        </div>
      </div>

      <div className="absolute inset-(--cut) -z-20 rounded-full" style={{ background: "var(--brand-gradient)" }} />

      <ArrowUp className="size-4" strokeWidth={2.5} />
    </button>
  );
}
