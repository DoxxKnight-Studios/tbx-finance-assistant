import { useEffect, useRef, useState } from "react";
import { AssistantMessage } from "@/components/chat/AssistantMessage";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import { SuggestionChips } from "@/components/chat/SuggestionChips";
import { UserMessage } from "@/components/chat/UserMessage";
import { ChatApiError, sendChatMessage } from "@/lib/api";
import { SUGGESTED_QUESTIONS } from "@/lib/suggestions";
import type { AssistantChatMessage, ChatMessage, UserChatMessage } from "@/types/chat";

function makeId(): string {
  return crypto.randomUUID();
}

function nextSuggestions(askedTexts: Set<string>): string[] {
  return SUGGESTED_QUESTIONS.filter((q) => !askedTexts.has(q)).slice(0, 3);
}

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const isBusy = messages.some(
    (m) => m.role === "assistant" && m.state === "loading",
  );

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function runAssistantReply(assistantId: string, text: string) {
    try {
      const result = await sendChatMessage(text);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.role === "assistant"
            ? ({ ...m, state: "resolved", result } satisfies AssistantChatMessage)
            : m,
        ),
      );
    } catch (error) {
      const errorText =
        error instanceof ChatApiError
          ? error.message
          : "Something went wrong. Please try again.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.role === "assistant"
            ? ({ ...m, state: "error", errorText } satisfies AssistantChatMessage)
            : m,
        ),
      );
    }
  }

  async function handleSend(rawText: string) {
    const text = rawText.trim();
    if (!text || isBusy) return;

    const userMessage: UserChatMessage = { id: makeId(), role: "user", text };
    const assistantId = makeId();
    const assistantMessage: AssistantChatMessage = {
      id: assistantId,
      role: "assistant",
      state: "loading",
      replyToText: text,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft("");

    await runAssistantReply(assistantId, text);
  }

  async function handleRetry(message: AssistantChatMessage) {
    setRetryingId(message.id);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id && m.role === "assistant"
          ? ({ ...m, state: "loading" } satisfies AssistantChatMessage)
          : m,
      ),
    );
    await runAssistantReply(message.id, message.replyToText);
    setRetryingId(null);
  }

  const askedTexts = new Set(
    messages.filter((m): m is UserChatMessage => m.role === "user").map((m) => m.text),
  );
  const lastMessage = messages[messages.length - 1];
  const showSuggestionChips =
    messages.length > 0 &&
    lastMessage?.role === "assistant" &&
    lastMessage.state === "resolved";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <EmptyState onSelectSuggestion={handleSend} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[1050px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
            {messages.map((message) =>
              message.role === "user" ? (
                <UserMessage key={message.id} text={message.text} />
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  onRetry={handleRetry}
                  retrying={retryingId === message.id}
                />
              ),
            )}

            {showSuggestionChips && (
              <SuggestionChips
                questions={nextSuggestions(askedTexts)}
                onSelect={handleSend}
              />
            )}

            <div ref={scrollAnchorRef} />
          </div>
        </div>
      )}

      <Composer value={draft} onChange={setDraft} onSubmit={() => handleSend(draft)} disabled={isBusy} />
    </div>
  );
}
