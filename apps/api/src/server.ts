import express from "express";
import cors from "cors";
import { checkDatabaseConnection } from "./db/health.js";
import { createChatRouter } from "./routes/chat.js";
import type { FinanceIntentParser } from "./ai/messagePipeline.js";

/**
 * apps/api/src/ai/intentParser.ts (the real Gemini-backed parser) lives
 * on a separate, not-yet-merged branch. Resolved through a non-literal
 * specifier so tsc doesn't require the file to exist on this branch
 * today; once that branch merges, this starts using it with no code
 * changes here. Until then, /api/chat stays mounted but reports a clear
 * parser_error instead of the server failing to start.
 */
async function resolveFinanceIntentParser(): Promise<FinanceIntentParser> {
  const intentParserModulePath = ["./ai/", "intentParser.js"].join("");

  try {
    const mod = (await import(intentParserModulePath)) as {
      parseFinanceIntent: FinanceIntentParser;
    };

    return mod.parseFinanceIntent;
  } catch {
    console.warn(
      "Gemini intent parser (./ai/intentParser.js) is not available on this branch yet - /api/chat will report parser_error until it's merged.",
    );

    return async () => {
      throw new Error(
        "The Gemini intent parser is not available on this branch yet.",
      );
    };
  }
}

async function main(): Promise<void> {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
    });
  });

  app.get("/health/db", async (_req, res) => {
    try {
      await checkDatabaseConnection();

      res.json({
        status: "ok",
        database: "connected",
      });
    } catch (error) {
      console.error("Database connection failed:", error);

      res.status(500).json({
        status: "error",
        database: "disconnected",
      });
    }
  });

  const parseFinanceIntent = await resolveFinanceIntentParser();
  app.use("/api", createChatRouter(parseFinanceIntent));

  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});
