import { MotionConfig } from "motion/react";
import { useState } from "react";
import { ChatShell } from "@/components/chat/ChatShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApiHealth } from "@/hooks/useApiHealth";
import { useTheme } from "@/hooks/useTheme";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const apiHealth = useApiHealth();
  const [personalSearch, setPersonalSearch] = useState(true);

  return (
    // reducedMotion="user" makes every Framer Motion animation in the tree
    // (avatar pulse, orb drift, answer reveal, etc.) honor the OS-level
    // prefers-reduced-motion setting, which plain CSS transitions can't see.
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        <div className="flex h-dvh flex-col bg-background app-background">
          <AppHeader
            theme={theme}
            onToggleTheme={toggleTheme}
            apiHealth={apiHealth}
            personalSearch={personalSearch}
            onTogglePersonalSearch={() => setPersonalSearch((value) => !value)}
          />
          <ChatShell
            personalSearch={personalSearch}
            onEnablePersonalSearch={() => setPersonalSearch(true)}
            onDisablePersonalSearch={() => setPersonalSearch(false)}
          />
      </TooltipProvider>
    </MotionConfig>
  );
}
