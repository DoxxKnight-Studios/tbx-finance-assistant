export function UserMessage({ text }: { text: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex justify-end duration-300">
      <div className="max-w-[80%] rounded-full bg-foreground px-5 py-3 text-[14px] leading-relaxed text-background sm:max-w-[70%]">
        {text}
      </div>
    </div>
  );
}
