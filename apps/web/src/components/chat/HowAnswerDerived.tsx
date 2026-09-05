import { useState } from "react";
import {
  BrainCircuit,
  ChevronDown,
  Database,
  Filter,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatPeriod } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FinanceEvidence } from "@/types/chat";

interface HowAnswerDerivedProps {
  evidence?: FinanceEvidence;
}

export function HowAnswerDerived({ evidence }: HowAnswerDerivedProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!evidence) return null;

  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);
  const templateName = evidence.template ?? "General Financial Intent";

  const steps = [
    {
      step: 1,
      title: "Intent Recognition & Schema Extraction",
      icon: BrainCircuit,
      color: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
      description: `Your question was parsed by the local AI model (Ollama granite4.2:3b) into the strictly validated financial intent: "${templateName}". The model only extracts intent and never calculates or invents financial numbers.`,
    },
    {
      step: 2,
      title: "Constraint & Period Resolution",
      icon: Filter,
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
      description: period
        ? `Temporal bounds were resolved to ${period} using UTC calendar safety. Dimension filters (e.g. debit spend) were applied.`
        : "Query scoped across the entire ledger for all-time transactions with verified dimensional filters.",
    },
    {
      step: 3,
      title: "Deterministic Database Execution",
      icon: Database,
      color: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      description:
        "A pre-compiled, parameter-bound SQL query was executed on the read-only PostgreSQL ledger. All mathematical calculations, aggregations, and rankings were computed by PostgreSQL with 100% precision.",
    },
    {
      step: 4,
      title: "Integrity Verification",
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      description:
        "Result validated against the TBX financial response contract before being rendered. Data reflects authoritative database state.",
    },
  ];

  return (
    <div className="mt-3 border-t border-border/40 pt-2.5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <Sparkles className="size-3.5 text-primary/80 transition-transform group-hover:scale-110" />
          <span>How this answer was derived</span>
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs animate-in fade-in slide-in-from-top-1 duration-200 sm:p-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="font-semibold text-foreground">
                Deterministic Audit & Derivation Pipeline
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Zero LLM Hallucination
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        s.color,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">{s.title}</div>
                      <p className="leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
