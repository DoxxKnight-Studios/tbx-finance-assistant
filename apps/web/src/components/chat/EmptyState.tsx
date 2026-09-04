import { GradientOrbs } from "@/components/decor/GradientOrbs";
import { SuggestionCard } from "@/components/chat/SuggestionCard";
import { SUGGESTED_QUESTIONS } from "@/lib/suggestions";

export function EmptyState({
  onSelectSuggestion,
}: {
  onSelectSuggestion: (question: string) => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-20">
      <GradientOrbs />

      <div
        className="mb-6 flex size-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-brand-glow animate-in fade-in zoom-in-95 duration-500"
        style={{ background: "var(--brand-gradient)" }}
        aria-hidden="true"
      >
        T
      </div>

      <h1 className="animate-in fade-in slide-in-from-bottom-2 max-w-lg text-balance text-center text-3xl font-semibold tracking-tight text-foreground duration-500 sm:text-4xl">
        Your financial data,
        <br />
        finally conversational.
      </h1>

      <p className="animate-in fade-in slide-in-from-bottom-2 mt-4 max-w-md text-balance text-center text-sm text-muted-foreground duration-500 [animation-delay:75ms] sm:text-base">
        Ask questions about payouts, transactions, vendors, and reconciliation
        in plain English.
      </p>

      <div className="animate-in fade-in slide-in-from-bottom-2 mt-10 grid w-full max-w-2xl gap-2.5 duration-500 [animation-delay:150ms] sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <SuggestionCard
            key={question}
            question={question}
            onSelect={onSelectSuggestion}
          />
        ))}
      </div>
    </div>
  );
}
