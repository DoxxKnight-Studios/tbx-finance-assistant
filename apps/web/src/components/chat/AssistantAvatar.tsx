import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-brand-glow",
        className,
      )}
      style={{ background: "var(--brand-gradient)" }}
    >
      <Sparkles className="size-4" strokeWidth={2.25} />
    </div>
  );
}
