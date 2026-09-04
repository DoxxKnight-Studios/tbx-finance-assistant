import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { AssistantAvatar } from "@/components/chat/AssistantAvatar";
import { EvidencePanel } from "@/components/chat/EvidencePanel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency, splitAroundAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatApiResult } from "@/types/chat";

export function AnswerCard({ result }: { result: ChatApiResult }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const formattedAmount =
    typeof result.summary?.amount === "string"
      ? formatCurrency(result.summary.amount, result.summary.currency)
      : undefined;

  const split = formattedAmount ? splitAroundAmount(result.answer, formattedAmount) : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 duration-300">
      <AssistantAvatar />

      <div className="min-w-0 flex-1">
        <div className="relative overflow-hidden rounded-2xl rounded-tl-sm border border-border/60 bg-card/70 px-4 py-3.5 backdrop-blur-sm">
          <p className="text-[15px] leading-relaxed text-foreground">
            {split ? (
              <>
                {split.before}
                <span className="text-brand-gradient text-xl font-semibold">
                  {split.amount}
                </span>
                {split.after}
              </>
            ) : (
              result.answer
            )}
          </p>

          {result.evidence && (
            <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
              <CollapsibleTrigger className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] rounded">
                View evidence
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    evidenceOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <EvidencePanel evidence={result.evidence} summary={result.summary} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}
