import "dotenv/config";
import { generateSeed } from "./generator.js";
import { verifyGeneratedSeed } from "./verify.js";
import { seedDatabase } from "./db.js";
import { pool } from "../db/client.js";
import { SEED, COMPANY_NAME } from "./data.js";
import { paiseToDecimalString } from "./money.js";

function formatPaise(paise: number): string {
  return `Rs ${paiseToDecimalString(paise)}`;
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  console.log(`Generating deterministic seed for ${COMPANY_NAME} (seed=${SEED})...`);
  const seed = generateSeed();

  console.log("Verifying in-memory dataset against Phase 3 invariants...");
  const report = verifyGeneratedSeed(seed);

  console.log("Writing to the database (bank -> account -> transaction)...");
  await seedDatabase(seed);

  const elapsedMs = Date.now() - startedAt;

  console.log("");
  console.log("Seed complete.");
  console.log(`  Banks:         ${report.bankCount}`);
  console.log(`  Accounts:      ${report.accountCount}`);
  console.log(`  Transactions:  ${report.transactionCount} (${report.debitCount} debit / ${report.creditCount} credit)`);
  console.log(
    `  Aug vs Jul 2026 debit spend: ${formatPaise(report.augustDebitTotalPaise)} vs ${formatPaise(report.julyDebitTotalPaise)} ` +
      `(x${report.augustOverJulyRatio.toFixed(3)})`,
  );
  console.log("  Bank debit ranking:");
  for (const row of report.bankDebitTotals) {
    console.log(`    ${row.bankCode.padEnd(6)} ${formatPaise(row.totalPaise)}`);
  }
  console.log("  Program debit ranking:");
  for (const row of report.programDebitTotals) {
    console.log(`    ${String(row.programId).padEnd(4)} ${formatPaise(row.totalPaise)}`);
  }
  console.log(
    `  Largest transaction: ${report.largestTransaction.transactionId} = ${formatPaise(report.largestTransaction.amountPaise)}`,
  );
  console.log(`  UTR: ${report.utrPresentCount} populated / ${report.utrNullCount} null`);
  console.log(`  Runtime: ${elapsedMs}ms`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
