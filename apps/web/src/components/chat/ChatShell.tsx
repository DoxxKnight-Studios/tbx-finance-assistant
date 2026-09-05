import { useEffect, useRef, useState } from "react";
import { AssistantMessage } from "@/components/chat/AssistantMessage";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import { SuggestionChips } from "@/components/chat/SuggestionChips";
import { UserMessage } from "@/components/chat/UserMessage";
import { ChatApiError, sendChatMessage } from "@/lib/api";
import { SUGGESTED_QUESTIONS } from "@/lib/suggestions";
import { useTheme } from "@/hooks/useTheme";
import type { AssistantChatMessage, ChatMessage, UserChatMessage } from "@/types/chat";

function makeId(): string {
  return crypto.randomUUID();
}

function nextSuggestions(askedTexts: Set<string>): string[] {
  return SUGGESTED_QUESTIONS.filter((q) => !askedTexts.has(q)).slice(0, 3);
}

export function ChatShell({
  personalSearch,
  onEnablePersonalSearch,
  onDisablePersonalSearch,
}: {
  personalSearch: boolean;
  onEnablePersonalSearch: () => void;
  onDisablePersonalSearch: () => void;
}) {
    const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  // const [conversationContext, setConversationContext] = useState<Record<string, unknown>>();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [conversationContext, setConversationContext] = useState<Record<string, unknown> | undefined
  >();
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const isBusy = messages.some(
    (m) => m.role === "assistant" && m.state === "loading",
  );

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function runAssistantReply(
    assistantId: string,
    text: string,
    context?: Record<string, unknown>,
    searchMode = personalSearch,
  ) {
    try {
      const result = await sendChatMessage(text, context, searchMode);
      if (result.conversationContext) {
        setConversationContext(result.conversationContext);
      }
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

  function handleEnablePersonalSearch(message: AssistantChatMessage) {
    onEnablePersonalSearch();
    setMessages((prev) =>
      prev.map((item) =>
        item.id === message.id && item.role === "assistant"
          ? { ...item, state: "loading" }
          : item,
      ),
    );
    void runAssistantReply(message.id, message.replyToText, conversationContext, true);
  }

  function handleDeclinePersonalSearch(message: AssistantChatMessage) {
    setMessages((prev) =>
      prev.map((item) =>
        item.id === message.id && item.role === "assistant"
          ? {
              ...item,
              result: {
                ...item.result,
                status: "general_answer",
                answer: "Okay. I will keep Personal search off and won't access your finance records.",
              },
            }
          : item,
      ),
    );
  }

  function handleDisablePersonalSearch(message: AssistantChatMessage) {
    onDisablePersonalSearch();
    setMessages((prev) =>
      prev.map((item) =>
        item.id === message.id && item.role === "assistant"
          ? { ...item, state: "loading" }
          : item,
      ),
    );
    void runAssistantReply(message.id, message.replyToText, conversationContext, false);
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

    await runAssistantReply(assistantId, text, conversationContext);
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
    await runAssistantReply(message.id, message.replyToText, conversationContext);
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
                  onEnablePersonalSearch={handleEnablePersonalSearch}
                  onDeclinePersonalSearch={handleDeclinePersonalSearch}
                  onDisablePersonalSearch={handleDisablePersonalSearch}
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

      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={() => handleSend(draft)}
        disabled={isBusy}
        personalSearch={personalSearch}
        theme={theme}
      />
    </div>
  );
}
