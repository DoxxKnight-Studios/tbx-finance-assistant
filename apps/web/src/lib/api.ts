import type { ChatApiResult } from "@/types/chat";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ChatApiError extends Error {}

/**
 * Posts a message to the existing POST /api/chat endpoint and returns its
 * JSON body verbatim (normalized to ChatApiResult). Never reshapes,
 * recalculates, or invents fields - only widens `message`/`answer` into a
 * single `answer` string so the UI has one field to render regardless of
 * which status the backend returned (e.g. the 400 invalid_request body
 * uses `message`, everything else uses `answer`).
 */
export async function sendChatMessage(
  message: string,
  conversationContext?: Record<string, unknown>,
): Promise<ChatApiResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationContext }),
    });
  } catch {
    throw new ChatApiError(
      "Couldn't reach the finance assistant. Check your connection and try again.",
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ChatApiError(
      "The finance assistant sent back an unexpected response. Please try again.",
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { status?: unknown }).status !== "string"
  ) {
    throw new ChatApiError(
      "The finance assistant sent back an unexpected response. Please try again.",
    );
  }

  const record = body as Record<string, unknown>;
  const answer = record.answer ?? record.message;

  if (typeof answer !== "string") {
    throw new ChatApiError(
      "The finance assistant sent back an unexpected response. Please try again.",
    );
  }

  return {
    status: record.status as string,
    answer,
    summary: record.summary as ChatApiResult["summary"],
    evidence: record.evidence as ChatApiResult["evidence"],
    conversationContext: record.conversationContext as ChatApiResult["conversationContext"],
  };
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}
