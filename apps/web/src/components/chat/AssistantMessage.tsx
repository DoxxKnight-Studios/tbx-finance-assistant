import { AnswerCard } from "@/components/chat/AnswerCard";
import { ErrorMessage } from "@/components/chat/ErrorMessage";
import { InfoMessage } from "@/components/chat/InfoMessage";
import { LoadingMessage } from "@/components/chat/LoadingMessage";
import type { AssistantChatMessage } from "@/types/chat";

const ERROR_STATUSES = new Set(["execution_error", "parser_error", "invalid_request"]);

export function AssistantMessage({
  message,
  onRetry,
  retrying,
}: {
  message: AssistantChatMessage;
  onRetry: (message: AssistantChatMessage) => void;
  retrying: boolean;
}) {
  if (message.state === "loading") {
    return <LoadingMessage />;
  }

  if (message.state === "error") {
    return (
      <ErrorMessage
        text={message.errorText ?? "Something went wrong. Please try again."}
        onRetry={() => onRetry(message)}
        retrying={retrying}
      />
    );
  }

  const result = message.result;
  if (!result) return null;

  if (result.status === "success") {
    return <AnswerCard result={result} />;
  }

  if (result.status === "clarification") {
    return <InfoMessage text={result.answer} variant="clarification" />;
  }

  if (ERROR_STATUSES.has(result.status)) {
    return (
      <ErrorMessage text={result.answer} onRetry={() => onRetry(message)} retrying={retrying} />
    );
  }

  // unsupported_ai_intent, unsupported_query_intent, not_found, and anything
  // else the backend might add - render as a neutral, non-alarming reply.
  return <InfoMessage text={result.answer} variant="info" />;
}
