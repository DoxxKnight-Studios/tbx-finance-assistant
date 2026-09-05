import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  Copy,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatBankName, getBankVisual } from "@/lib/bankUtils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FinanceEvidence } from "@/types/chat";

interface TransactionReceiptCardProps {
  evidence: FinanceEvidence;
}

export function TransactionReceiptCard({ evidence }: TransactionReceiptCardProps) {
  const [copied, setCopied] = useState(false);
  const txn = evidence.transaction;
  if (!txn) return null;

  const isDebit = txn.transactionType?.toLowerCase() === "debit";
  const formattedAmount =
    typeof txn.amount === "string" ? formatCurrency(txn.amount) : "—";

  const bankVisual = getBankVisual(txn.bank?.name, txn.bank?.code);
  const bankTitle = formatBankName(txn.bank?.name, txn.bank?.code);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="size-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Transaction Details
          </h4>
          <Badge
            variant="outline"
            className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            <ShieldCheck className="size-3" />
            Verified
          </Badge>
        </div>

        {/* Transaction Type Badge */}
        <Badge
          className={cn(
            "h-6 gap-1 px-2.5 text-xs font-semibold",
            isDebit
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          )}
          variant="outline"
        >
          {isDebit ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
          {isDebit ? "Debit (Spend)" : "Credit (Income)"}
        </Badge>
      </div>

      {/* Hero Amount */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Transaction Amount
        </span>
        <div className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {formattedAmount}
        </div>
      </div>

      {/* Key Fields Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {/* Bank & Program */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/50 p-3">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold",
              bankVisual.bgClass,
              bankVisual.colorClass,
              bankVisual.borderClass,
            )}
          >
            {bankVisual.code.slice(0, 3)}
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-muted-foreground">Settled Via</span>
            <span className="truncate text-xs font-semibold text-foreground sm:text-sm">
              {bankTitle} {txn.programId !== undefined ? `· Program ${txn.programId}` : ""}
            </span>
          </div>
        </div>

        {/* Reference Number with Copy */}
        {txn.reference && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/50 p-3">
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-muted-foreground">
                Reference ID
              </span>
              <span className="truncate font-mono text-xs font-semibold text-foreground">
                {txn.reference}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(txn.reference || "")}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:text-foreground"
              title="Copy reference ID"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Date & Description */}
      {(txn.transactionDate || txn.description) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
          {txn.transactionDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              <span>Date: {txn.transactionDate.split("T")[0]}</span>
            </div>
          )}
          {txn.description && <span className="truncate italic">"{txn.description}"</span>}
        </div>
      )}
    </div>
  );
}
