import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ApiHealthState } from "@/hooks/useApiHealth";
import type { Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

function StatusIndicator({ status }: { status: ApiHealthState }) {
  const label =
    status === "online" ? "Connected" : status === "offline" ? "Offline" : "Connecting";

  return (
    <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "online" && "bg-emerald-500",
          status === "offline" && "bg-destructive/70",
          status === "checking" && "animate-pulse bg-muted-foreground/50",
        )}
      />
      {label}
    </div>
  );
}

export function AppHeader({
  theme,
  onToggleTheme,
  apiHealth,
  personalSearch,
  onTogglePersonalSearch,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  apiHealth: ApiHealthState;
  personalSearch: boolean;
  onTogglePersonalSearch: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1050px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-xl text-[13px] font-bold text-white shadow-brand-glow"
            style={{ background: "var(--brand-gradient)" }}
          >
            T
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-tight">
              TBX <span className="text-muted-foreground font-normal">Finance</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusIndicator status={apiHealth} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={personalSearch ? "secondary" : "outline"}
                size="sm"
                aria-pressed={personalSearch}
                aria-label={personalSearch ? "Personal search on" : "Personal search off"}
                onClick={onTogglePersonalSearch}
              >
                {personalSearch ? <ShieldCheck /> : <ShieldOff />}
                <span className="hidden sm:inline">Personal search</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {personalSearch ? "Uses your grounded finance data" : "General AI mode"}
            </TooltipContent>
          </Tooltip>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
