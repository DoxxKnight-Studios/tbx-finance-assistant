import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CreditCard,
  Hash,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatPeriod } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { RankingVisualCard } from "./RankingVisualCard";
import { SummaryVisualCard } from "./SummaryVisualCard";
import { ComparisonVisualCard } from "./ComparisonVisualCard";
import { TransactionReceiptCard } from "./TransactionReceiptCard";
import { AccountBalanceCard } from "./AccountBalanceCard";
import type { FinanceEvidence, FinanceSummary } from "@/types/chat";


const TEMPLATE_LABELS: Record<string, string> = {
  transaction_spend_total: "Spend Total",
  transaction_income_total: "Income Total",
  transaction_count: "Transaction Count",
  transaction_spend_by_bank: "Spend by Bank Breakdown",
  transaction_spend_by_program: "Spend by Program Breakdown",
  transaction_summary: "Activity Summary",
  largest_transaction: "Largest Transaction",
  transaction_lookup: "Transaction Lookup",
  account_balance: "Account Balance",
  financial_comparison: "Period Comparison",
};

function AmountTotalVisualCard({
  evidence,
  summary,
}: {
  evidence: FinanceEvidence;
  summary?: FinanceSummary;
}) {
  const rawAmount = typeof summary?.amount === "string" ? summary.amount : evidence.amount;
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);
  const isSpend = evidence.template === "transaction_spend_total";

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {isSpend ? (
              <ArrowDownRight className="size-4 text-rose-500" />
            ) : (
              <ArrowUpRight className="size-4 text-emerald-500" />
            )}
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {isSpend ? "Total Debit Spend" : "Total Credit Income"}
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

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {isSpend ? "Verified Debit Amount" : "Verified Credit Amount"}
        </span>
        <div className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {typeof rawAmount === "string" ? formatCurrency(rawAmount, summary?.currency) : "—"}
        </div>
      </div>

      {(evidence.bank?.code || evidence.programId !== undefined || evidence.account?.last4) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {evidence.bank?.code && (
            <Badge variant="secondary" className="gap-1">
              <Building2 className="size-3" />
              {evidence.bank.name ?? evidence.bank.code}
            </Badge>
          )}
          {evidence.programId !== undefined && (
            <Badge variant="secondary" className="gap-1">
              <Layers className="size-3" />
              Program {evidence.programId}
            </Badge>
          )}
          {evidence.account?.last4 && (
            <Badge variant="secondary" className="gap-1 font-mono">
              <CreditCard className="size-3" />
              •••• {evidence.account.last4}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function TransactionCountVisualCard({ evidence }: { evidence: FinanceEvidence }) {
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Hash className="size-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Transaction Count
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

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Total Matching Transactions
        </span>
        <div className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {evidence.count ?? 0}
        </div>
      </div>

      {(evidence.transactionType || evidence.bank?.code) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {evidence.transactionType && (
            <Badge variant="outline" className="capitalize">
              {evidence.transactionType}
            </Badge>
          )}
          {evidence.bank?.code && (
            <Badge variant="secondary">
              {evidence.bank.name ?? evidence.bank.code}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function EvidencePanel({
  evidence,
  summary,
}: {
  evidence: FinanceEvidence;
  summary?: FinanceSummary;
}) {
  const period = formatPeriod(evidence.period?.start, evidence.period?.endExclusive);

  // Render rich visual component based on query template
  let visualContent: React.ReactNode;

  switch (evidence.template) {
    case "transaction_spend_by_bank":
    case "transaction_spend_by_program":
      visualContent = (
        <RankingVisualCard
          rankings={evidence.rankings ?? []}
          period={period}
          isProgram={evidence.template === "transaction_spend_by_program"}
        />
      );
      break;

    case "transaction_summary":
      visualContent = <SummaryVisualCard evidence={evidence} period={period} />;
      break;

    case "financial_comparison":
      visualContent = <ComparisonVisualCard evidence={evidence} />;
      break;

    case "largest_transaction":
    case "transaction_lookup":
      visualContent = <TransactionReceiptCard evidence={evidence} />;
      break;

    case "account_balance":
      visualContent = <AccountBalanceCard evidence={evidence} />;
      break;

    case "transaction_count":
      visualContent = <TransactionCountVisualCard evidence={evidence} />;
      break;

    case "transaction_spend_total":
    case "transaction_income_total":
      visualContent = <AmountTotalVisualCard evidence={evidence} summary={summary} />;
      break;

    default:
      if (evidence.rankings && evidence.rankings.length > 0) {
        visualContent = <RankingVisualCard rankings={evidence.rankings} period={period} />;
      } else {
        visualContent = <AmountTotalVisualCard evidence={evidence} summary={summary} />;
      }
  }

  return <div className="mt-3 w-full">{visualContent}</div>;
}

