import { AlertTriangle, RotateCcw } from "lucide-react";
import { AssistantAvatar } from "@/components/chat/AssistantAvatar";
import { Button } from "@/components/ui/button";

export function ErrorMessage({
  text,
  onRetry,
  retrying,
}: {
  text: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 duration-300">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-destructive/25 bg-destructive/5 px-4 py-3.5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive/80" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-relaxed text-foreground/90">{text}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
              className="mt-2.5 h-7 gap-1.5 text-xs"
            >
              <RotateCcw className={retrying ? "size-3 animate-spin" : "size-3"} />
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
