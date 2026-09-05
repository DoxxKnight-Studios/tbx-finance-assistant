import { useReducedMotion } from "motion/react";
import { GradientOrbs } from "@/components/decor/GradientOrbs";
import { SuggestionCard } from "@/components/chat/SuggestionCard";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { TextAnimate } from "@/components/ui/text-animate";
import { SUGGESTED_QUESTIONS } from "@/lib/suggestions";

export function EmptyState({
  onSelectSuggestion,
}: {
  onSelectSuggestion: (question: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-20 sm:py-24">
      <GradientOrbs />

      <div
        className="mb-7 flex size-18 items-center justify-center rounded-3xl text-2xl font-bold text-white shadow-brand-glow animate-in fade-in zoom-in-95 duration-500"
        style={{ background: "var(--brand-gradient)" }}
        aria-hidden="true"
      >
        TBX+
      </div>

      <h1 className="max-w-lg text-balance text-center text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {prefersReducedMotion ? (
          <span className="block">Your financial data,</span>
        ) : (
          <TextAnimate
            as="span"
            by="word"
            animation="blurInUp"
            duration={0.5}
            startOnView={false}
            className="block"
            segmentClassName="inline-block"
          >
            Your financial data,
          </TextAnimate>
        )}
        <AnimatedGradientText
          speed={0.8}
          colorFrom="var(--brand-pink)"
          colorTo="var(--brand-purple)"
          className="animate-in fade-in slide-in-from-bottom-2 block font-semibold duration-500 [animation-delay:280ms] fill-mode-backwards"
        >
          finally conversational.
        </AnimatedGradientText>
      </h1>

      <p className="animate-in fade-in slide-in-from-bottom-2 mt-5 max-w-md text-balance text-center text-base text-muted-foreground duration-500 [animation-delay:380ms] fill-mode-backwards">
        Ask questions about payouts, transactions, vendors, and reconciliation
        in plain English.
      </p>

      <div className="animate-in fade-in slide-in-from-bottom-2 mt-12 grid w-full max-w-2xl gap-3 duration-500 [animation-delay:480ms] fill-mode-backwards sm:grid-cols-2">
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
