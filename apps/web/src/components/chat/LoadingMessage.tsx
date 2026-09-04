import { AssistantAvatar } from "@/components/chat/AssistantAvatar";

export function LoadingMessage() {
  return (
    <div className="animate-in fade-in flex items-start gap-3 duration-300">
      <AssistantAvatar />
      <div className="flex items-center gap-2.5 pt-1.5">
        <div className="flex items-center gap-1">
          <span className="animate-shimmer-dot size-1.5 rounded-full bg-foreground/50 [animation-delay:-0.32s]" />
          <span className="animate-shimmer-dot size-1.5 rounded-full bg-foreground/50 [animation-delay:-0.16s]" />
          <span className="animate-shimmer-dot size-1.5 rounded-full bg-foreground/50" />
        </div>
        <span className="text-[13px] text-muted-foreground">
          Analyzing your financial data…
        </span>
      </div>
    </div>
  );
}
