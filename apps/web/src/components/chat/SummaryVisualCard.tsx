import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Hash,
  Landmark,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { FinanceEvidence } from "@/types/chat";

interface SummaryVisualCardProps {
  evidence: FinanceEvidence;
  period?: string;
}

export function SummaryVisualCard({ evidence, period }: SummaryVisualCardProps) {
  const debits = typeof evidence.debitTotal === "string" ? formatCurrency(evidence.debitTotal) : null;
  const credits = typeof evidence.creditTotal === "string" ? formatCurrency(evidence.creditTotal) : null;
  const net = typeof evidence.net === "string" ? formatCurrency(evidence.net) : null;
  const count = typeof evidence.count === "number" ? evidence.count : null;

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="size-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Financial Activity Summary
          </h4>
          <Badge
            variant="outline"
            className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            <ShieldCheck className="size-3" />
            Verified
          </Badge>
        </div>

        {period && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            <span>{period}</span>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Debits (Spend) */}
        {debits && (
          <div className="relative overflow-hidden rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 dark:bg-rose-500/10">
            <div className="flex items-center justify-between text-xs font-medium text-rose-600 dark:text-rose-400">
              <span>Total Outflow (Debits)</span>
              <ArrowDownRight className="size-4" />
            </div>
            <div className="mt-2 text-base font-bold tabular-nums text-foreground sm:text-lg">
              {debits}
            </div>
          </div>
        )}

        {/* Credits (Income) */}
        {credits && (
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 dark:bg-emerald-500/10">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span>Total Inflow (Credits)</span>
              <ArrowUpRight className="size-4" />
            </div>
            <div className="mt-2 text-base font-bold tabular-nums text-foreground sm:text-lg">
              {credits}
            </div>
          </div>
        )}

        {/* Net */}
        {net && (
          <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted/40 p-3.5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Net Movement</span>
              <Landmark className="size-4" />
            </div>
            <div className="mt-2 text-base font-bold tabular-nums text-foreground sm:text-lg">
              {net}
            </div>
          </div>
        )}
      </div>

      {count !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
          <Hash className="size-3.5 text-primary" />
          <span>
            Total Transactions Processed: <strong className="text-foreground">{count}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
