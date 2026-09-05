import { useReducedMotion } from "motion/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { SendButton } from "@/components/chat/SendButton";
import { BorderBeam } from "@/components/ui/border-beam";
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
  const [focused, setFocused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const canSend = value.trim().length > 0 && !disabled;
  const showBeam = (focused || disabled) && !prefersReducedMotion;

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
      <div className="mx-auto max-w-[1050px] px-4 py-4 sm:px-6 sm:py-5">
        <div
          className={cn(
            "relative flex items-end gap-2 overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-2.5 shadow-sm backdrop-blur-sm transition-all duration-200",
            "focus-within:border-transparent focus-within:shadow-[0_10px_30px_-14px_var(--brand-glow)]",
          )}
        >
          {showBeam && (
            <BorderBeam
              duration={6}
              size={90}
              colorFrom="var(--brand-pink)"
              colorTo="var(--brand-purple)"
            />
          )}

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => handleInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ask about spend, income, banks, programs, or accounts…"
            rows={1}
            aria-label="Message the finance assistant"
            className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          />

          <SendButton disabled={!canSend} onClick={onSubmit} />
        </div>
        <p className="mt-2 px-1 text-center text-[11px] text-muted-foreground/70">
          Answers are generated from your financial records, not estimates.
        </p>
      </div>
    </div>
  );
}
