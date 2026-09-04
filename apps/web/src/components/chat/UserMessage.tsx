export function UserMessage({ text }: { text: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex justify-end duration-300">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-2.5 text-[13px] leading-relaxed text-background sm:max-w-[70%]">
        {text}
      </div>
    </div>
  );
}
