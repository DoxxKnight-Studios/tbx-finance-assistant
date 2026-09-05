import { AssistantAvatar } from "@/components/chat/AssistantAvatar";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

export function LoadingMessage() {
  return (
    <div className="animate-in fade-in flex items-center gap-3 duration-300">
      <AssistantAvatar animated />
      <AnimatedGradientText
        speed={1.4}
        colorFrom="var(--brand-pink)"
        colorTo="var(--brand-purple)"
        className="text-[13px] font-medium"
      >
        Analyzing your financial data…
      </AnimatedGradientText>
    </div>
  );
}
