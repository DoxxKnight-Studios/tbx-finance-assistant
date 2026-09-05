import { CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatBankName, getBankVisual } from "@/lib/bankUtils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FinanceEvidence } from "@/types/chat";

interface AccountBalanceCardProps {
  evidence: FinanceEvidence;
}

export function AccountBalanceCard({ evidence }: AccountBalanceCardProps) {
  const balance =
    typeof evidence.availableBalance === "string"
      ? formatCurrency(evidence.availableBalance)
      : "—";

  const bankVisual = getBankVisual(evidence.bank?.name, evidence.bank?.code);
  const bankTitle = formatBankName(evidence.bank?.name, evidence.bank?.code);
  const last4 = evidence.account?.last4 ?? "••••";

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Account Balance
          </h4>
          <Badge
            variant="outline"
            className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            <ShieldCheck className="size-3" />
            Verified
          </Badge>
        </div>

        <Badge variant="secondary" className="font-mono text-xs font-semibold">
          •••• {last4}
        </Badge>
      </div>

      {/* Virtual Card Graphic */}
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-card via-muted/40 to-muted/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-lg border text-xs font-bold",
                bankVisual.bgClass,
                bankVisual.colorClass,
                bankVisual.borderClass,
              )}
            >
              {bankVisual.code.slice(0, 3)}
            </div>
            <span className="text-xs font-semibold text-foreground">{bankTitle}</span>
          </div>
          <Sparkles className="size-4 text-muted-foreground/60" />
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current Available Balance
          </span>
          <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {balance}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] font-medium text-muted-foreground">
          <span>Account Number</span>
          <span className="font-mono tracking-wider">•••• •••• •••• {last4}</span>
        </div>
      </div>
    </div>
  );
}
