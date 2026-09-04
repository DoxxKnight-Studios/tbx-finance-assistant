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

  get geminiApiKey(): string {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    return geminiApiKey;
  },

  get geminiModel(): string {
    return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  },
};