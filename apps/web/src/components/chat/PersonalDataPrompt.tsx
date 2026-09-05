import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantAvatar } from "@/components/chat/AssistantAvatar";

export function PersonalDataPrompt({
  text,
  onEnable,
  onDecline,
  enableLabel = "Enable personal search",
  declineLabel = "Keep general mode",
}: {
  text: string;
  onEnable: () => void;
  onDecline: () => void;
  enableLabel?: string;
  declineLabel?: string;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 duration-300">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 rounded-3xl border border-border/60 bg-card/60 px-5 py-4 backdrop-blur-sm">
        <p className="text-[14px] leading-relaxed text-foreground/90">{text}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={onEnable}>
            <ShieldCheck />
            {enableLabel}
          </Button>
          <Button size="sm" variant="outline" onClick={onDecline}>
            <ShieldOff />
            {declineLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
