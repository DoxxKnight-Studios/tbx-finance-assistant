import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { ApiHealthState } from "@/hooks/useApiHealth";
import type { Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

function StatusIndicator({ status }: { status: ApiHealthState }) {
  const label =
        status === "online"
      ? "Connected"
      : status === "offline"
        ? "Offline"
        : "Connecting";

  return (
    <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground sm:flex 
    dark:border-white/10 dark:bg-[#080b12]/50 dark:text-[#9aa0a6]">
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
}: {
  theme: Theme;
  onToggleTheme: () => void;
  apiHealth: ApiHealthState;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1050px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <img
            src={theme === "dark" ? "/Dark_Logo.png" : "/logo.png"}
              alt="TBX Finance"
              className={theme === "dark" ? "h-18 w-auto object-contain" : "size-75 object-contain"}
            />
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status={apiHealth} />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        </div>
    </header>
  );
}
