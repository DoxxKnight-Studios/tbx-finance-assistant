import { motion, useReducedMotion } from "motion/react";
import { AssistantAvatar } from "@/components/chat/AssistantAvatar";
import { EvidencePanel } from "@/components/chat/EvidencePanel";
import { HowAnswerDerived } from "@/components/chat/HowAnswerDerived";
import { MessageActions } from "@/components/chat/MessageActions";
import { formatCurrency, splitAroundAmount } from "@/lib/format";
import type { ChatApiResult } from "@/types/chat";

export function AnswerCard({ result }: { result: ChatApiResult }) {
  const prefersReducedMotion = useReducedMotion();

  const formattedAmount =
    typeof result.summary?.amount === "string"
      ? formatCurrency(result.summary.amount, result.summary.currency)
      : undefined;

  const split = formattedAmount ? splitAroundAmount(result.answer, formattedAmount) : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 duration-300">
      <AssistantAvatar />

      <div className="min-w-0 flex-1">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm sm:p-5">
          <motion.p
            className="text-[15px] leading-relaxed text-foreground"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
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
          </motion.p>

          {result.evidence && (
            <EvidencePanel evidence={result.evidence} summary={result.summary} />
          )}

          {result.evidence && (
            <HowAnswerDerived evidence={result.evidence} />
          )}

          {/* Action Toolbar: Copy, Download, and System Verification */}
          <div className="mt-3.5 flex items-center justify-between border-t border-border/40 pt-2.5">
            <MessageActions result={result} />
            <span className="text-[11px] font-medium text-muted-foreground/60">
              Verified TBX Intelligence
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
