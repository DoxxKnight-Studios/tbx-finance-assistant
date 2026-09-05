import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Copies exact text via the Clipboard API, with a legacy execCommand
 * fallback for contexts where navigator.clipboard is unavailable (e.g.
 * non-HTTPS/local dev in some browsers). Never throws - callers get a
 * boolean so they can show a failure state instead of crashing.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy fallback below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  text,
  label = "Copy",
  className,
  size = "icon-xs",
}: {
  text: string;
  label?: string;
  className?: string;
  size?: "icon-xs" | "icon-sm" | "xs" | "sm";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleClick() {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 1500);
  }

  const isIconOnly = size === "icon-xs" || size === "icon-sm";

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={handleClick}
      className={cn("text-muted-foreground", className)}
      aria-label={
        state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed" : label
      }
    >
      {state === "copied" ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {!isIconOnly && (
        <span>{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}</span>
      )}
    </Button>
  );
}
