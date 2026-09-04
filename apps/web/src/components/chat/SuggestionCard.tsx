import { ArrowUpRight } from "lucide-react";

export function SuggestionCard({
  question,
  onSelect,
}: {
  question: string;
  onSelect: (question: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(question)}
      className="group relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-xl border border-border/70 bg-card/60 px-4 py-3.5 text-left text-sm text-foreground/90 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-[0_10px_30px_-12px_var(--brand-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: "var(--brand-gradient-soft)" }}
      />
      <span className="relative leading-snug">{question}</span>
      <ArrowUpRight className="relative mt-0.5 size-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}
