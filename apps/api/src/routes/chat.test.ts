import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createChatRouter } from "./chat.js";
import type { FinanceIntentParser } from "../ai/messagePipeline.js";

const mockParser: FinanceIntentParser = async (message) => {
  if (message.includes("Acme Corporation")) {
    return {
      status: "success",
      intent: {
        intent: "vendor_payout_total",
        vendor: { name: "Acme Corporation" },
        date_range: { type: "month", year: 2026, month: 8 },
      },
    };
  }

  if (message.includes("Acme")) {
    return {
      status: "success",
      intent: {
        intent: "vendor_payout_total",
        vendor: { name: "Acme" },
        date_range: { type: "last_month" },
      },
    };
  }

  if (message.includes("revenue by account")) {
    return {
      status: "success",
      intent: {
        intent: "reconciliation_summary",
        date_range: { type: "last_month" },
      },
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

  it("runs a full message through parsing, planning, and execution", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "How much did we pay Acme Corporation in August?",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe("success");
    expect(typeof body.answer).toBe("string");
    expect(body.answer).toContain("Acme Corporation");
    expect(body.evidence.template).toBe("vendor_payout_total");
    expect(body.evidence.period.start).toBe("2026-08-01");
    expect(Array.isArray(body.evidence.rows)).toBe(true);
    expect(body.conversationContext.intent).toBe("vendor_payout_total");
  });

  it("surfaces ambiguous-vendor clarification instead of silently picking one", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "How much did we pay Acme in August?",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("clarification");
    expect(typeof body.answer).toBe("string");
  });

  it("executes a reconciliation summary query", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Show me our revenue by account.",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.evidence.template).toBe("reconciliation_summary");
  });

  it("asks before switching an unsupported request to general AI mode", async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "tell me a joke" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("general_query_confirmation");
    expect(body.originalMessage).toBe("tell me a joke");
  });
});
