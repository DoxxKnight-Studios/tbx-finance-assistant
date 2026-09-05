import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createChatRouter } from "./chat.js";
import type { FinanceIntentParser } from "../ai/messagePipeline.js";

/**
 * Exercises the full route -> messagePipeline -> queryPlanner ->
 * queryTemplateRegistry -> responseFormatter chain against the real
 * seeded local database (only the Gemini call itself is mocked, per the
 * project's convention throughout - never a live LLM call in tests).
 */
const mockParser: FinanceIntentParser = async (message) => {
  if (message.includes("spend") && message.includes("August")) {
    return {
      status: "success",
      intent: {
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 8 },
      },
    };
  }

  if (message.includes("Definitely Not A Real Bank")) {
    return {
      status: "success",
      intent: {
        intent: "transaction_spend_total",
        bank: { code: "Definitely Not A Real Bank" },
      },
    };
  }

  if (message.includes("balance")) {
    return {
      status: "clarification",
      question: "Which account would you like me to check?",
    };
  }

  if (message.includes("joke")) {
    return {
      status: "unsupported",
      message: "Telling jokes is not a supported finance query.",
    };
  }

  throw new Error("mockParser: no case for this message");
};

describe("POST /api/chat", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", createChatRouter(mockParser));

    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected server to bind to a TCP port");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("rejects a request with no message as invalid_request", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.status).toBe("invalid_request");
  });

  it("runs a full message through parsing, planning, execution, and formatting", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "How much did we spend in August?" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe("success");
    expect(typeof body.answer).toBe("string");
    expect(body.answer).toBe("You spent ₹252,786,141.26 in August 2026.");
    expect(body.summary).toEqual({ amount: "252786141.26", currency: "INR" });
    expect(body.evidence.template).toBe("transaction_spend_total");
    expect(body.evidence.period.start).toBe("2026-08-01");
  });

  it("surfaces a clarification request instead of guessing which account", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What is my balance?" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("clarification");
    expect(body.answer).toBe("Which account would you like me to check?");
  });

  it("returns not_found for a bank that doesn't exist, rather than fabricating a total", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "How much did Definitely Not A Real Bank spend?" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("not_found");
  });

  it("fails cleanly for a request outside supported finance intents", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "tell me a joke" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("unsupported_ai_intent");
  });
});
