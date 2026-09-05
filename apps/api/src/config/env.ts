import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();


export const env = {
  get databaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not configured");
    }
    return databaseUrl;
  },

  get aiProvider(): "ollama" | "gemini" {
    const provider = process.env.AI_PROVIDER?.toLowerCase();
    if (provider === "gemini") {
      return "gemini";
    }
    return "ollama";
  },

  get ollamaBaseUrl(): string {
    return process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  },

  get ollamaModel(): string {
    return process.env.OLLAMA_MODEL || "granite4.2:3b";
  },

  get ollamaThinking(): string {
    return process.env.OLLAMA_THINKING || "low";
  },

  get geminiApiKey(): string {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey && env.aiProvider === "gemini") {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    return geminiApiKey || "";
  },

  get geminiModel(): string {
    return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  },
};