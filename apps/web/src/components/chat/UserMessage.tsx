import { CopyButton } from "@/components/chat/CopyButton";

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 group flex items-center justify-end gap-1.5 duration-300">
      <CopyButton
        text={text}
        label="Copy message"
        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-sm:opacity-60"
      />
      <div className="max-w-[80%] rounded-full bg-foreground px-5 py-3 text-[14px] leading-relaxed text-background sm:max-w-[70%]">
        {text}
      </div>
    </div>
  );
}
