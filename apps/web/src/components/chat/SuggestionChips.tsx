export function SuggestionChips({
  questions,
  onSelect,
}: {
  questions: readonly string[];
  onSelect: (question: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex flex-wrap items-center gap-2 px-1 duration-300">
      <span className="text-xs text-muted-foreground">Try asking</span>
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-foreground/80 backdrop-blur-sm transition-colors hover:border-transparent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
          style={{ backgroundImage: "var(--brand-gradient-soft)" }}
        >
          {question}
        </button>
      ))}
    </div>
  );
}
