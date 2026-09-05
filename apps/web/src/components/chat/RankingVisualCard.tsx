import { useState } from "react";
import { motion } from "motion/react";
import {
  Building2,
  Calendar,
  Check,
  Copy,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatBankName, getBankVisual } from "@/lib/bankUtils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SpendRankingRow } from "@/types/chat";

interface RankingVisualCardProps {
  rankings: SpendRankingRow[];
  period?: string;
  isProgram?: boolean;
}

export function RankingVisualCard({
  rankings,
  period,
  isProgram = false,
}: RankingVisualCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Calculate aggregate total and max for proportional scaling
  const totalSum = rankings.reduce((acc, row) => {
    const val = parseFloat(row.total || "0");
    return acc + (Number.isNaN(val) ? 0 : val);
  }, 0);

  const maxAmount = Math.max(
    ...rankings.map((r) => parseFloat(r.total || "0")),
    1,
  );

  const formattedTotal = formatCurrency(totalSum.toFixed(2));

  function handleCopy(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      {/* Header Summary Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isProgram ? (
                <Layers className="size-4" />
              ) : (
                <Building2 className="size-4" />
              )}
            </div>
            <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {isProgram ? "Spend by Program" : "Spend by Bank"}
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

        {/* Total Aggregate Card */}
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-right sm:px-4">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Aggregate ({rankings.length} {isProgram ? "Programs" : "Banks"})
          </span>
          <span className="text-sm font-bold tabular-nums text-foreground sm:text-base">
            {formattedTotal}
          </span>
        </div>
      </div>

      {/* Ranking Rows */}
      <div className="space-y-2 pt-1">
        {rankings.map((row, index) => {
          const val = parseFloat(row.total || "0");
          const percentOfTotal = totalSum > 0 ? (val / totalSum) * 100 : 0;
          const percentOfMax = maxAmount > 0 ? (val / maxAmount) * 100 : 0;

          const formattedVal =
            typeof row.total === "string" ? formatCurrency(row.total) : "—";

          const bankVisual = !isProgram
            ? getBankVisual(row.bankName, row.bankCode)
            : null;

          const title = isProgram
            ? `Program ${row.programId ?? index + 1}`
            : formatBankName(row.bankName, row.bankCode);

          const isCopied = copiedIndex === index;

          // Calm and simple tabular rank number
          const rankBadge = (
            <span className="w-4 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground/80">
              {index + 1}
            </span>
          );

          return (
            <motion.div
              key={row.bankCode ?? row.programId ?? index}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className="group relative overflow-hidden rounded-xl border border-border/50 bg-background/60 p-3 transition-all duration-200 hover:border-border hover:bg-background/90 hover:shadow-sm"
            >
              {/* Background Proportional Progress Fill */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl opacity-[0.08] transition-all duration-500 ease-out group-hover:opacity-[0.14] dark:opacity-[0.12] dark:group-hover:opacity-[0.2]"
                style={{
                  width: `${percentOfMax}%`,
                  background: "var(--brand-gradient)",
                }}
              />

              <div className="relative flex items-center justify-between gap-3">
                {/* Left Side: Rank + Monogram + Title */}
                <div className="flex min-w-0 items-center gap-2.5">
                  {rankBadge}

                  {bankVisual && (
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-transform group-hover:scale-105",
                        bankVisual.bgClass,
                        bankVisual.colorClass,
                        bankVisual.borderClass,
                      )}
                      title={bankVisual.name}
                    >
                      {bankVisual.code.slice(0, 3)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {title}
                      </span>
                    </div>

                    {/* Proportional visual track underneath name */}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted/60 sm:w-32">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${percentOfMax}%`,
                            background: "var(--brand-gradient)",
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                        {percentOfTotal.toFixed(1)}% of total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Amount + Copy Button */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-foreground sm:text-base">
                    {formattedVal}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCopy(formattedVal, index)}
                    className="flex size-7 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Copy amount"
                  >
                    {isCopied ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
