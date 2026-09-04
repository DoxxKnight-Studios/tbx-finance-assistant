import { ArrowUp } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  }

  function handleInput(next: string) {
    onChange(next);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }

  return (
    <div className="sticky bottom-0 z-10 border-t border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-[1050px] px-4 py-3 sm:px-6 sm:py-4">
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border border-border/70 bg-card/80 p-2 shadow-sm backdrop-blur-sm transition-all duration-200 focus-within:border-transparent focus-within:shadow-[0_0_0_1.5px_var(--brand-magenta),0_10px_30px_-14px_var(--brand-glow)]",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => handleInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about payouts, vendors, or reconciliation…"
            rows={1}
            aria-label="Message the finance assistant"
            className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <button
            type="button"
            aria-label="Send message"
            disabled={!canSend}
            onClick={onSubmit}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            style={{ background: "var(--brand-gradient)" }}
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-center text-[11px] text-muted-foreground/70">
          Answers are generated from your financial records, not estimates.
        </p>
      </div>
    </div>
  );
}
