import express from "express";
import cors from "cors";
import { checkDatabaseConnection } from "./db/health.js";

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

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});