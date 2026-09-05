import { HelpCircle, Info } from "lucide-react";
import { AssistantAvatar } from "@/components/chat/AssistantAvatar";

/** Renders clarification questions and graceful "not supported" replies - never as an error. */
export function InfoMessage({
  text,
  variant,
}: {
  text: string;
  variant: "clarification" | "info";
}) {
  const Icon = variant === "clarification" ? HelpCircle : Info;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 duration-300">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 rounded-3xl border border-border/60 bg-card/50 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-[14px] leading-relaxed text-foreground/90">{text}</p>
        </div>
      </div>
    </div>
  );
}
