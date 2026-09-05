import { ChevronDown, Download } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { AssistantAvatar } from "@/components/chat/AssistantAvatar";
import { CopyButton } from "@/components/chat/CopyButton";
import { EvidencePanel } from "@/components/chat/EvidencePanel";
import { TechnicalTracePanel } from "@/components/chat/TechnicalTracePanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportResultAsCsv,
  exportResultAsJson,
  getExportableRankingRows,
} from "@/lib/export";
import { formatCurrency, splitAroundAmount } from "@/lib/format";
import type { ChatApiResult } from "@/types/chat";

function CollapsibleTriggerLabel({
  open,
  children,
}: {
  open: boolean;
  children: string;
}) {
  return (
    <>
      {children}
      <ChevronDown
        className={cn(
          "size-3.5 transition-transform duration-200",
          open && "rotate-180",
        )}
      />
    </>
  );
}

export function AnswerCard({ result }: { result: ChatApiResult }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const formattedAmount =
    typeof result.summary?.amount === "string"
      ? formatCurrency(result.summary.amount, result.summary.currency)
      : undefined;

  const split = formattedAmount
    ? splitAroundAmount(result.answer, formattedAmount)
    : null;
  const csvRows = getExportableRankingRows(result);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 duration-300">
      <AssistantAvatar />

      <div className="min-w-0 flex-1">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 px-5 py-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <motion.p
              className="text-[15px] leading-relaxed text-foreground"
              initial={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, y: 6, filter: "blur(4px)" }
              }
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

            <div className="flex shrink-0 items-center gap-0.5">
              <CopyButton text={result.answer} label="Copy answer" />
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Export this response"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-ring)"
                >
                  <Download className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => exportResultAsJson(result)}>
                    Export as JSON
                  </DropdownMenuItem>
                  {csvRows && (
                    <DropdownMenuItem
                      onSelect={() => exportResultAsCsv(result)}
                    >
                      Export as CSV
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 flex flex-col items-start gap-2">
            {result.evidence && (
              <Collapsible
                open={evidenceOpen}
                onOpenChange={setEvidenceOpen}
                className="w-full min-w-0"
              >
                <CollapsibleTrigger className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--brand-ring) focus-visible:outline-none">
                  <CollapsibleTriggerLabel open={evidenceOpen}>
                    View evidence
                  </CollapsibleTriggerLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <EvidencePanel
                    evidence={result.evidence}
                    summary={result.summary}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {result.technical && (
              <Collapsible
                open={traceOpen}
                onOpenChange={setTraceOpen}
                className="w-full min-w-0"
              >
                <CollapsibleTrigger className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--brand-ring) focus-visible:outline-none">
                  <CollapsibleTriggerLabel open={traceOpen}>
                    How this answer was derived
                  </CollapsibleTriggerLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <TechnicalTracePanel technical={result.technical} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
