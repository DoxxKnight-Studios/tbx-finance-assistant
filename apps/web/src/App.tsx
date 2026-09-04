import { ChatShell } from "@/components/chat/ChatShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApiHealth } from "@/hooks/useApiHealth";
import { useTheme } from "@/hooks/useTheme";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const apiHealth = useApiHealth();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh flex-col bg-background">
        <AppHeader theme={theme} onToggleTheme={toggleTheme} apiHealth={apiHealth} />
        <ChatShell />
      </div>
    </TooltipProvider>
  );
}
