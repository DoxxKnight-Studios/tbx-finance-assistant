import "dotenv/config";

import {
  generateSeedData,
} from "./generator";
import {
  seedDatabase,
} from "./db";

interface CliOptions {
  transactions: number;
  seed?: string;
}

function parseArgs(
  args: string[],
): CliOptions {
  let transactions = 25_000;
  let seed: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (
      arg === "--transactions" ||
      arg === "-t"
    ) {
      const value = args[++i];

      if (!value) {
        throw new Error(
          "--transactions requires a value",
        );
      }

      transactions = Number(value);

      if (
        !Number.isInteger(transactions) ||
        transactions < 30
      ) {
        throw new Error(
          "--transactions must be an integer >= 30",
        );
      }
    } else if (arg === "--seed") {
      seed = args[++i];

      if (!seed) {
        throw new Error(
          "--seed requires a value",
        );
      }
    } else if (
      arg === "--help" ||
      arg === "-h"
    ) {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(
        `Unknown argument: ${arg}`,
      );
    }
  }

  return {
    transactions,
    seed,
  };
}

function printHelp(): void {
  console.log(`
TBX Finance Assistant - synthetic database seed

Usage:

  npm run seed
  npm run seed -- --transactions 25000
  npm run seed -- --transactions 50000
  npm run seed -- --transactions 25000 --seed 20260904

Options:

  -t, --transactions <n>
      Number of transactions to generate.
      Default: 25000
      Minimum: 30

  --seed <value>
      Deterministic seed.
      Supplying the same seed and transaction count
      produces the same generated dataset.

  -h, --help
      Show this help.
`);
}

function formatINR(
  amount: number,
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

function printFixtureSummary(
  data: ReturnType<typeof generateSeedData>,
): void {
  console.log(
    "\n=== Deterministic Test Fixtures ===",
  );

  const grouped = new Map<
    string,
    {
      august: number;
      july: number;
      total: number;
    }
  >();

  for (
    const transaction of data.fixtureTransactions
  ) {
    const vendor =
      transaction.vendorId!;

    const current =
      grouped.get(vendor) ?? {
        august: 0,
        july: 0,
        total: 0,
      };

    const amount =
      Number(transaction.amount);

    current.total += amount;

    if (
      transaction.date.startsWith(
        "2026-08",
      )
    ) {
      current.august += amount;
    }

    if (
      transaction.date.startsWith(
        "2026-07",
      )
    ) {
      current.july += amount;
    }

    grouped.set(vendor, current);
  }

  for (
    const vendor of data.vendors.filter(
      (vendor) =>
        vendor.vendorCode.startsWith(
          "TEST-VENDOR-",
        ),
    )
  ) {
    const totals =
      grouped.get(vendor.id);

    if (!totals) continue;

    console.log(
      `\n${vendor.name} (${vendor.vendorCode})`,
    );

    console.log(
      `  August payout total : ${formatINR(
        totals.august,
      )}`,
    );

    console.log(
      `  July payout total   : ${formatINR(
        totals.july,
      )}`,
    );

    console.log(
      `  Fixture total       : ${formatINR(
        totals.total,
      )}`,
    );
  }

  console.log(
    "\nFixture references:",
  );

  for (
    const transaction of data.fixtureTransactions
  ) {
    console.log(
      `  ${transaction.reference} | ${transaction.date} | ${formatINR(
        Number(transaction.amount),
      )}`,
    );
  }
}

function printAggregateSummary(
  data: ReturnType<typeof generateSeedData>,
): void {
  let totalSpend = 0;

  const byType = new Map<
    string,
    {
      count: number;
      amount: number;
    }
  >();

  const byStatus = new Map<
    string,
    number
  >();

  const byRecon = new Map<
    string,
    number
  >();

  const byMonth = new Map<
    string,
    {
      count: number;
      amount: number;
    }
  >();

  for (
    const transaction of data.transactions
  ) {
    const amount =
      Number(transaction.amount);

    totalSpend += amount;

    const type =
      byType.get(
        transaction.transactionType,
      ) ?? {
        count: 0,
        amount: 0,
      };

    type.count += 1;
    type.amount += amount;

    byType.set(
      transaction.transactionType,
      type,
    );

    byStatus.set(
      transaction.status,
      (byStatus.get(
        transaction.status,
      ) ?? 0) + 1,
    );

    const month =
      transaction.date.slice(0, 7);

    const monthly =
      byMonth.get(month) ?? {
        count: 0,
        amount: 0,
      };

    monthly.count += 1;
    monthly.amount += amount;

    byMonth.set(month, monthly);
  }

  for (
    const reconciliation of data.reconciliations
  ) {
    byRecon.set(
      reconciliation.status,
      (byRecon.get(
        reconciliation.status,
      ) ?? 0) + 1,
    );
  }

  console.log(
    "\n=== Final Aggregate Summary ===",
  );

  console.log(
    `Vendors          : ${data.vendors.length}`,
  );

  console.log(
    `Accounts         : ${data.accounts.length}`,
  );

  console.log(
    `Transactions     : ${data.transactions.length}`,
  );

  console.log(
    `Reconciliations  : ${data.reconciliations.length}`,
  );

  console.log(
    `Total amount     : ${formatINR(
      totalSpend,
    )}`,
  );

  console.log("\nBy transaction type:");

  for (
    const [type, value] of byType
  ) {
    console.log(
      `  ${type.padEnd(
        20,
      )} ${String(value.count).padStart(
        7,
      )} ${formatINR(value.amount)}`,
    );
  }

  console.log(
    "\nTransaction statuses:",
  );

  for (
    const [status, count] of byStatus
  ) {
    console.log(
      `  ${status.padEnd(
        12,
      )} ${count}`,
    );
  }

  console.log(
    "\nReconciliation statuses:",
  );

  for (
    const [status, count] of byRecon
  ) {
    console.log(
      `  ${status.padEnd(
        14,
      )} ${count}`,
    );
  }

  console.log(
    "\nMonthly transaction volume:",
  );

  for (
    const [month, value] of byMonth
  ) {
    console.log(
      `  ${month}  ${String(
        value.count,
      ).padStart(
        7,
      )}  ${formatINR(value.amount)}`,
    );
  }
}

async function main(): Promise<void> {
  try {
    const options =
      parseArgs(process.argv.slice(2));

    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set.",
      );
    }

    console.log(
      "TBX Finance Assistant seed generator",
    );

    console.log(
      `Transactions requested: ${options.transactions}`,
    );

    console.log(
      `Seed: ${
        options.seed ??
        "(random)"
      }`,
    );

    console.log(
      "\nGenerating synthetic dataset...",
    );

    const data =
      generateSeedData(
        options.transactions,
        options.seed,
      );

    console.log(
      `Generated ${data.vendors.length} vendors`,
    );

    console.log(
      `Generated ${data.accounts.length} accounts`,
    );

    console.log(
      `Generated ${data.transactions.length} transactions`,
    );

    console.log(
      `Generated ${data.reconciliations.length} reconciliations`,
    );

    console.log(
      "\nInserting into PostgreSQL...",
    );

    await seedDatabase(
      data.vendors,
      data.accounts,
      data.transactions,
      data.reconciliations,
      (completed, total) => {
        const percentage =
          (
            (completed / total) *
            100
          ).toFixed(1);

        process.stdout.write(
          `\rTransactions inserted: ${completed}/${total} (${percentage}%)`,
        );

        if (completed === total) {
          process.stdout.write("\n");
        }
      },
    );

    printFixtureSummary(data);
    printAggregateSummary(data);

    console.log(
      "\nSeed completed successfully.",
    );
  } catch (error) {
    console.error(
      "\nSeed failed:",
    );

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode = 1;
  }
}

void main();