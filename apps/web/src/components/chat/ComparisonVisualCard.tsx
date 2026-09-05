import {
  ArrowRight,
  GitCompare,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatPeriod } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FinanceEvidence } from "@/types/chat";

interface ComparisonVisualCardProps {
  evidence: FinanceEvidence;
}

export function ComparisonVisualCard({ evidence }: ComparisonVisualCardProps) {
  const primaryPeriodStr = formatPeriod(
    evidence.primaryPeriod?.start,
    evidence.primaryPeriod?.endExclusive,
  );
  const secondaryPeriodStr = formatPeriod(
    evidence.secondaryPeriod?.start,
    evidence.secondaryPeriod?.endExclusive,
  );

  const isCount = evidence.metric === "transaction_count";

  const pVal = parseFloat(evidence.primaryValue || "0");
  const sVal = parseFloat(evidence.secondaryValue || "0");

  let deltaPercent: number | null = null;
  if (!Number.isNaN(pVal) && !Number.isNaN(sVal) && sVal !== 0) {
    deltaPercent = ((pVal - sVal) / sVal) * 100;
  }

  const primaryFormatted = isCount
    ? evidence.primaryValue ?? "—"
    : formatCurrency(evidence.primaryValue || "0");

  const secondaryFormatted = isCount
    ? evidence.secondaryValue ?? "—"
    : formatCurrency(evidence.secondaryValue || "0");

  const metricLabel =
    evidence.metric === "spend"
      ? "Total Spend"
      : evidence.metric === "income"
        ? "Total Income"
        : "Transaction Count";

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitCompare className="size-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Period Comparison ({metricLabel})
          </h4>
          <Badge
            variant="outline"
            className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            <ShieldCheck className="size-3" />
            Verified
          </Badge>
        </div>

        {deltaPercent !== null && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
              deltaPercent >= 0
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
            )}
          >
            {deltaPercent >= 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            <span>
              {deltaPercent >= 0 ? "+" : ""}
              {deltaPercent.toFixed(1)}% vs Prior Period
            </span>
          </div>
        )}
      </div>

      {/* Comparison Cards Side-by-Side */}
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
        {/* Secondary (Prior Period) */}
        <div className="relative rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <span className="text-xs font-medium text-muted-foreground">
            {secondaryPeriodStr ?? "Prior Period"}
          </span>
          <div className="mt-1 text-base font-bold tabular-nums text-foreground/80 sm:text-lg">
            {secondaryFormatted}
          </div>
        </div>

        {/* Primary (Current / Focus Period) */}
        <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-3.5 dark:bg-primary/10">
          <div className="flex items-center justify-between text-xs font-medium text-primary">
            <span>{primaryPeriodStr ?? "Focus Period"}</span>
            <ArrowRight className="size-3.5" />
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-foreground sm:text-lg">
            {primaryFormatted}
          </div>
        </div>
      </div>
    </div>
  );
}
