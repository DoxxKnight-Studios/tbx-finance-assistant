import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { checkDatabaseConnection } from "./db/health.js";
import { ensureDatabaseFeatures } from "./db/features.js";
import { createChatRouter } from "./routes/chat.js";
import { parseFinanceIntent } from "./ai/intentParser.js";

async function main(): Promise<void> {
  await ensureDatabaseFeatures();

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

  app.use("/api", createChatRouter(parseFinanceIntent));

  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
    console.log(
      `AI Provider: ${env.aiProvider} (Model: ${env.aiProvider === "gemini" ? env.geminiModel : env.ollamaModel}, Thinking: ${env.ollamaThinking})`
    );
  });
}

main().catch((error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});
