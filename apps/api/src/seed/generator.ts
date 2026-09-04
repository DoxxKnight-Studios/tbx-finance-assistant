import { createHash, randomBytes } from "node:crypto";

import {
  ACCOUNTS,
  RECONCILIATION_STATUSES,
  TRANSACTION_CATEGORIES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  VENDOR_CATEGORIES,
  VENDOR_NAMES,
  type ReconciliationStatus,
  type TransactionCategory,
  type TransactionStatus,
  type TransactionType,
} from "./data";

export interface VendorSeed {
  id: string;
  vendorCode: string;
  name: string;
  category: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export interface AccountSeed {
  id: string;
  accountCode: string;
  name: string;
  accountType:
    | "ASSET"
    | "LIABILITY"
    | "EQUITY"
    | "REVENUE"
    | "EXPENSE";
  parentAccountId: string | null;
  currency: "INR";
  status: "ACTIVE" | "INACTIVE";
}

export interface TransactionSeed {
  id: string;
  reference: string;
  date: string;
  vendorId: string | null;
  accountId: string;
  amount: string;
  currency: "INR";
  transactionType: TransactionType;
  category: TransactionCategory;
  status: TransactionStatus;
  description: string;
  createdAt: string;
}

export interface ReconciliationSeed {
  id: string;
  transactionId: string;
  status: ReconciliationStatus;
  reconciledAmount: string;
  reconciledAt: string | null;
  reconciliationRef: string | null;
  differenceAmount: string;
  notes: string | null;
}

export interface GeneratedData {
  vendors: VendorSeed[];
  accounts: AccountSeed[];
  transactions: TransactionSeed[];
  reconciliations: ReconciliationSeed[];
  fixtureTransactions: TransactionSeed[];
  fixtureReconciliations: ReconciliationSeed[];
}

class RNG {
  private state: number;

  constructor(seed: string) {
    const digest = createHash("sha256")
      .update(seed)
      .digest();

    this.state =
      digest.readUInt32LE(0) ^
      digest.readUInt32LE(4) ^
      digest.readUInt32LE(8) ^
      digest.readUInt32LE(12);

    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(
      this.next() * (max - min + 1),
    ) + min;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  weighted<T>(
    items: readonly T[],
    weights: readonly number[],
  ): T {
    if (items.length !== weights.length) {
      throw new Error("Items and weights must have equal length");
    }

    const total = weights.reduce(
      (sum, weight) => sum + weight,
      0,
    );

    let target = this.next() * total;

    for (let i = 0; i < items.length; i += 1) {
      target -= weights[i];

      if (target <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }
}

function deterministicUuid(seed: string): string {
  const hash = createHash("sha256")
    .update(seed)
    .digest("hex");

  const h = hash.slice(0, 32);

  const versioned =
    h.slice(0, 12) +
    "5" +
    h.slice(13, 16) +
    "8" +
    h.slice(17);

  return [
    versioned.slice(0, 8),
    versioned.slice(8, 12),
    versioned.slice(12, 16),
    versioned.slice(16, 20),
    versioned.slice(20, 32),
  ].join("-");
}

function money(value: number): string {
  return value.toFixed(2);
}

function randomDate(
  rng: RNG,
  start: Date,
  end: Date,
): string {
  const timestamp =
    start.getTime() +
    rng.next() *
      (end.getTime() - start.getTime());

  return new Date(timestamp)
    .toISOString()
    .slice(0, 10);
}

function randomDateTime(
  rng: RNG,
  date: string,
): string {
  const hour = rng.int(8, 20);
  const minute = rng.int(0, 59);
  const second = rng.int(0, 59);

  return `${date}T${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}:${String(second).padStart(2, "0")}+05:30`;
}

function chooseAmount(
  rng: RNG,
  category: TransactionCategory,
): number {
  const baseRanges: Record<
    TransactionCategory,
    [number, number]
  > = {
    OFFICE_SUPPLIES: [1500, 85000],
    RAW_MATERIALS: [25000, 750000],
    SOFTWARE: [3000, 250000],
    LOGISTICS: [5000, 450000],
    TRAVEL: [2500, 90000],
    MARKETING: [10000, 500000],
    PROFESSIONAL_SERVICES: [15000, 400000],
    UTILITIES: [5000, 150000],
    RENT: [60000, 450000],
    INSURANCE: [20000, 250000],
    TAX: [10000, 650000],
    OTHER: [1000, 120000],
  };

  const [min, max] = baseRanges[category];

  /*
   * Log-like distribution:
   * Most transactions sit toward the lower/middle part
   * of their category's range rather than being uniform.
   */
  const u = rng.next();
  let amount = min + (max - min) * Math.pow(u, 2.15);

  /*
   * ~1.5% deliberately large transactions.
   */
  if (rng.next() < 0.015) {
    amount *= rng.next() < 0.65 ? 4 : 10;
  }

  return Math.max(
    100,
    Math.round(amount / 100) * 100,
  );
}

function chooseTransactionType(
  rng: RNG,
): TransactionType {
  return rng.weighted(
    TRANSACTION_TYPES,
    [0.72, 0.06, 0.06, 0.06, 0.06, 0.04],
  );
}

function chooseTransactionStatus(
  rng: RNG,
): TransactionStatus {
  return rng.weighted(
    TRANSACTION_STATUSES,
    [0.88, 0.05, 0.04, 0.03],
  );
}

function chooseReconciliationStatus(
  rng: RNG,
  transactionStatus: TransactionStatus,
): ReconciliationStatus {
  if (
    transactionStatus === "FAILED" ||
    transactionStatus === "CANCELLED"
  ) {
    return rng.weighted(
      RECONCILIATION_STATUSES,
      [0.05, 0.45, 0.10, 0.40],
    );
  }

  if (transactionStatus === "PENDING") {
    return rng.weighted(
      RECONCILIATION_STATUSES,
      [0.15, 0.65, 0.15, 0.05],
    );
  }

  return rng.weighted(
    RECONCILIATION_STATUSES,
    [0.70, 0.15, 0.10, 0.05],
  );
}

function accountForTransaction(
  type: TransactionType,
  category: TransactionCategory,
  accountIds: Map<string, string>,
): string {
  const categoryAccount: Record<
    TransactionCategory,
    string
  > = {
    OFFICE_SUPPLIES: "5100",
    RAW_MATERIALS: "5000",
    SOFTWARE: "5200",
    LOGISTICS: "5300",
    TRAVEL: "5400",
    MARKETING: "5500",
    PROFESSIONAL_SERVICES: "5600",
    UTILITIES: "5700",
    RENT: "5800",
    INSURANCE: "5900",
    TAX: "6000",
    OTHER: "6300",
  };

  if (type === "FEE") {
    return accountIds.get("6100")!;
  }

  if (type === "REFUND") {
    return accountIds.get("6200")!;
  }

  if (type === "RECEIPT") {
    return accountIds.get("4100")!;
  }

  if (type === "INTERNAL_TRANSFER") {
    return accountIds.get("1010")!;
  }

  return accountIds.get(categoryAccount[category])!;
}

function chooseCategory(
  rng: RNG,
  type: TransactionType,
): TransactionCategory {
  if (type === "FEE") {
    return "OTHER";
  }

  if (type === "REFUND") {
    return rng.pick([
      "OFFICE_SUPPLIES",
      "SOFTWARE",
      "TRAVEL",
      "LOGISTICS",
      "OTHER",
    ]);
  }

  if (type === "RECEIPT") {
    return rng.pick([
      "OTHER",
      "PROFESSIONAL_SERVICES",
      "SOFTWARE",
    ]);
  }

  return rng.weighted(
    TRANSACTION_CATEGORIES,
    [
      0.09,
      0.13,
      0.12,
      0.11,
      0.07,
      0.08,
      0.10,
      0.08,
      0.07,
      0.05,
      0.06,
      0.04,
    ],
  );
}

function descriptionFor(
  rng: RNG,
  type: TransactionType,
  category: TransactionCategory,
  vendorName: string | null,
): string {
  const subject = vendorName ?? "internal finance operation";

  const descriptions: Record<
    TransactionType,
    string[]
  > = {
    VENDOR_PAYOUT: [
      `Invoice settlement for ${category.toLowerCase().replaceAll("_", " ")} - ${subject}`,
      `Vendor payment for ${category.toLowerCase().replaceAll("_", " ")} services`,
      `Scheduled supplier payout to ${subject}`,
      `Settlement against approved vendor invoice`,
      `Monthly vendor payable settlement`,
    ],
    REFUND: [
      `Refund received for ${category.toLowerCase().replaceAll("_", " ")}`,
      `Supplier refund adjustment`,
      `Refund against prior invoice`,
      `Credit adjustment from ${subject}`,
    ],
    INTERNAL_TRANSFER: [
      "Transfer between operating accounts",
      "Internal treasury movement",
      "Operating cash allocation",
      "Inter-account funds transfer",
    ],
    FEE: [
      "Bank processing fee",
      "Payment gateway fee",
      "Transaction processing charge",
      "Bank service charge",
    ],
    RECEIPT: [
      "Customer payment receipt",
      "Service revenue receipt",
      "Product revenue collection",
      "Customer settlement received",
    ],
    OTHER: [
      "Miscellaneous operating transaction",
      "General finance adjustment",
      "Administrative expense",
      "Other operating transaction",
    ],
  };

  return rng.pick(descriptions[type]);
}

function monthWeightedDate(
  rng: RNG,
): string {
  const months = [
    { month: 1, weight: 10 },
    { month: 2, weight: 11 },
    { month: 3, weight: 12 },
    { month: 4, weight: 12 },
    { month: 5, weight: 13 },
    { month: 6, weight: 13 },
    { month: 7, weight: 14 },
    { month: 8, weight: 15 },
  ];

  const selected = rng.weighted(
    months,
    months.map((m) => m.weight),
  );

  const lastDay = new Date(
    Date.UTC(2026, selected.month, 0),
  ).getUTCDate();

  const day = rng.int(1, lastDay);

  return `2026-${String(selected.month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function createReconciliation(
  rng: RNG,
  transaction: TransactionSeed,
  index: number,
): ReconciliationSeed {
  const status = chooseReconciliationStatus(
    rng,
    transaction.status,
  );

  const amount = Number(transaction.amount);

  switch (status) {
    case "RECONCILED":
      return {
        id: deterministicUuid(
          `${transaction.id}:reconciliation`,
        ),
        transactionId: transaction.id,
        status,
        reconciledAmount: transaction.amount,
        reconciledAt: randomDateTime(
          rng,
          transaction.date,
        ),
        reconciliationRef: `RECON-${String(index + 1).padStart(
          8,
          "0",
        )}`,
        differenceAmount: "0.00",
        notes: null,
      };

    case "UNRECONCILED":
      return {
        id: deterministicUuid(
          `${transaction.id}:reconciliation`,
        ),
        transactionId: transaction.id,
        status,
        reconciledAmount: "0.00",
        reconciledAt: null,
        reconciliationRef: null,
        differenceAmount: money(amount),
        notes: null,
      };

    case "PARTIAL": {
      const ratio =
        0.45 + rng.next() * 0.45;

      const reconciled =
        Math.floor((amount * ratio) / 100) * 100;

      const difference =
        amount - reconciled;

      return {
        id: deterministicUuid(
          `${transaction.id}:reconciliation`,
        ),
        transactionId: transaction.id,
        status,
        reconciledAmount: money(reconciled),
        reconciledAt: null,
        reconciliationRef: null,
        differenceAmount: money(difference),
        notes: "Partial settlement; remaining amount requires follow-up.",
      };
    }

    case "EXCEPTION": {
      const difference =
        Math.max(
          500,
          Math.round(
            amount *
              (0.01 + rng.next() * 0.12),
          ) / 100,
        );

      const reconciled =
        Math.max(0, amount - difference);

      return {
        id: deterministicUuid(
          `${transaction.id}:reconciliation`,
        ),
        transactionId: transaction.id,
        status,
        reconciledAmount: money(reconciled),
        reconciledAt: null,
        reconciliationRef: `EXC-${String(index + 1).padStart(
          8,
          "0",
        )}`,
        differenceAmount: money(difference),
        notes: rng.pick([
          "Amount mismatch detected during bank reconciliation.",
          "Supporting document does not match settlement amount.",
          "Payment reference requires manual investigation.",
          "Unexpected variance identified during reconciliation.",
        ]),
      };
    }
  }
}

function createFixtures(
  rng: RNG,
  vendors: VendorSeed[],
  accounts: AccountSeed[],
): {
  transactions: TransactionSeed[];
  reconciliations: ReconciliationSeed[];
} {
  const vendorMap = new Map(
    vendors.map((vendor) => [
      vendor.vendorCode,
      vendor,
    ]),
  );

  const accountMap = new Map(
    accounts.map((account) => [
      account.accountCode,
      account.id,
    ]),
  );

  const fixtureDefinitions = [
    {
      vendorCode: "TEST-VENDOR-ACME",
      vendorName: "Acme Corporation",
      records: [
        ["2026-08-03", 125000, "RECONCILED"],
        ["2026-08-09", 85000, "RECONCILED"],
        ["2026-08-17", 4200000, "UNRECONCILED"],
        ["2026-08-26", 95000, "RECONCILED"],
        ["2026-07-04", 110000, "RECONCILED"],
        ["2026-07-13", 175000, "PARTIAL"],
        ["2026-07-28", 260000, "UNRECONCILED"],
        ["2026-06-12", 90000, "RECONCILED"],
        ["2026-05-21", 140000, "EXCEPTION"],
        ["2026-04-15", 60000, "RECONCILED"],
      ],
    },
    {
      vendorCode: "TEST-VENDOR-GLOBEX",
      vendorName: "Globex Industries",
      records: [
        ["2026-08-05", 180000, "RECONCILED"],
        ["2026-08-12", 225000, "RECONCILED"],
        ["2026-08-23", 950000, "UNRECONCILED"],
        ["2026-07-07", 150000, "RECONCILED"],
        ["2026-07-18", 310000, "PARTIAL"],
        ["2026-07-29", 125000, "UNRECONCILED"],
        ["2026-06-08", 75000, "RECONCILED"],
        ["2026-05-17", 190000, "EXCEPTION"],
        ["2026-04-22", 80000, "RECONCILED"],
        ["2026-03-11", 65000, "RECONCILED"],
      ],
    },
    {
      vendorCode: "TEST-VENDOR-STARK",
      vendorName: "Stark Technologies",
      records: [
        ["2026-08-02", 210000, "RECONCILED"],
        ["2026-08-15", 135000, "RECONCILED"],
        ["2026-08-27", 1250000, "UNRECONCILED"],
        ["2026-07-03", 205000, "RECONCILED"],
        ["2026-07-16", 295000, "PARTIAL"],
        ["2026-07-25", 180000, "UNRECONCILED"],
        ["2026-06-19", 110000, "RECONCILED"],
        ["2026-05-13", 160000, "EXCEPTION"],
        ["2026-04-07", 95000, "RECONCILED"],
        ["2026-03-23", 70000, "RECONCILED"],
      ],
    },
  ] as const;

  const transactions: TransactionSeed[] = [];
  const reconciliations: ReconciliationSeed[] = [];

  let sequence = 1;

  for (const fixture of fixtureDefinitions) {
    const vendor = vendorMap.get(
      fixture.vendorCode,
    );

    if (!vendor) {
      throw new Error(
        `Fixture vendor missing: ${fixture.vendorCode}`,
      );
    }

    for (const [
      date,
      amount,
      reconciliationStatus,
    ] of fixture.records) {
      const id = deterministicUuid(
        `fixture:${fixture.vendorCode}:${sequence}`,
      );

      const transaction: TransactionSeed = {
        id,
        reference: `TEST-${fixture.vendorCode
          .replace("TEST-VENDOR-", "")
          .toUpperCase()}-${String(sequence).padStart(
          3,
          "0",
        )}`,
        date,
        vendorId: vendor.id,
        accountId: accountMap.get("5000")!,
        amount: money(amount),
        currency: "INR",
        transactionType: "VENDOR_PAYOUT",
        category: "RAW_MATERIALS",
        status: "COMPLETED",
        description: `Deterministic test payout for ${vendor.name}`,
        createdAt: `${date}T10:00:00+05:30`,
      };

      let reconciliation: ReconciliationSeed;

      if (reconciliationStatus === "RECONCILED") {
        reconciliation = {
          id: deterministicUuid(`${id}:reconciliation`),
          transactionId: id,
          status: "RECONCILED",
          reconciledAmount: transaction.amount,
          reconciledAt: `${date}T16:00:00+05:30`,
          reconciliationRef: `TEST-RECON-${sequence}`,
          differenceAmount: "0.00",
          notes: null,
        };
      } else if (
        reconciliationStatus === "UNRECONCILED"
      ) {
        reconciliation = {
          id: deterministicUuid(`${id}:reconciliation`),
          transactionId: id,
          status: "UNRECONCILED",
          reconciledAmount: "0.00",
          reconciledAt: null,
          reconciliationRef: null,
          differenceAmount: transaction.amount,
          notes: null,
        };
      } else if (
        reconciliationStatus === "PARTIAL"
      ) {
        const partial = Math.floor(amount * 0.6 / 100) * 100;

        reconciliation = {
          id: deterministicUuid(`${id}:reconciliation`),
          transactionId: id,
          status: "PARTIAL",
          reconciledAmount: money(partial),
          reconciledAt: null,
          reconciliationRef: null,
          differenceAmount: money(
            amount - partial,
          ),
          notes: "Deterministic partial reconciliation fixture.",
        };
      } else {
        const difference = Math.floor(amount * 0.08 / 100) * 100;

        reconciliation = {
          id: deterministicUuid(`${id}:reconciliation`),
          transactionId: id,
          status: "EXCEPTION",
          reconciledAmount: money(
            amount - difference,
          ),
          reconciledAt: null,
          reconciliationRef: `TEST-EXCEPTION-${sequence}`,
          differenceAmount: money(difference),
          notes:
            "Deterministic exception fixture for reconciliation testing.",
        };
      }

      transactions.push(transaction);
      reconciliations.push(reconciliation);

      sequence += 1;
    }
  }

  void rng;

  return {
    transactions,
    reconciliations,
  };
}

export function generateSeedData(
  transactionCount: number,
  seed?: string,
): GeneratedData {
  if (
    !Number.isInteger(transactionCount) ||
    transactionCount < 30
  ) {
    throw new Error(
      "Transaction count must be an integer >= 30 because 30 deterministic fixtures are always generated.",
    );
  }

  const effectiveSeed =
    seed ??
    randomBytes(16).toString("hex");

  const rng = new RNG(effectiveSeed);

  const vendors: VendorSeed[] = VENDOR_NAMES.map(
    (name, index) => {
      const isFixtureVendor =
        index === 0 ||
        index === 1 ||
        index === 2;

      return {
        id: deterministicUuid(
          `${effectiveSeed}:vendor:${index}`,
        ),
        vendorCode: isFixtureVendor
          ? [
              "TEST-VENDOR-ACME",
              "TEST-VENDOR-GLOBEX",
              "TEST-VENDOR-STARK",
            ][index]
          : `VND-${String(index + 1).padStart(
              4,
              "0",
            )}`,
        name,
        category: rng.pick(VENDOR_CATEGORIES),
        status:
          rng.next() < 0.93
            ? "ACTIVE"
            : "INACTIVE",
        createdAt: "2025-01-01T00:00:00+05:30",
      };
    },
  );

  /*
   * Give fixture vendors their explicit names while
   * keeping the remaining vendor list realistic.
   */
  vendors[0].name = "Acme Corporation";
  vendors[1].name = "Globex Industries";
  vendors[2].name = "Stark Technologies";

  const accountIds = new Map<string, string>();

  for (const account of ACCOUNTS) {
    accountIds.set(
      account.code,
      deterministicUuid(
        `${effectiveSeed}:account:${account.code}`,
      ),
    );
  }

  const accounts: AccountSeed[] = ACCOUNTS.map(
    (account) => ({
      id: accountIds.get(account.code)!,
      accountCode: account.code,
      name: account.name,
      accountType: account.type,
      parentAccountId: account.parentCode
        ? accountIds.get(account.parentCode) ?? null
        : null,
      currency: "INR",
      status: "ACTIVE",
    }),
  );

  const fixtureData = createFixtures(
    rng,
    vendors,
    accounts,
  );

  const remaining =
    transactionCount -
    fixtureData.transactions.length;

  const transactions: TransactionSeed[] = [
    ...fixtureData.transactions,
  ];

  const reconciliations: ReconciliationSeed[] = [
    ...fixtureData.reconciliations,
  ];

  /*
   * Reserve two vendor payouts for every vendor.
   * This guarantees even the long tail has activity.
   */
  const vendorFloor = vendors.map(
    (vendor) => ({
      vendor,
      remaining: 2,
    }),
  );

  let sequence = 1;

  while (
    sequence <= remaining
  ) {
    const vendorFloorItem =
      vendorFloor.find(
        (item) => item.remaining > 0,
      );

    let type: TransactionType;

    if (vendorFloorItem) {
      type = "VENDOR_PAYOUT";
      vendorFloorItem.remaining -= 1;
    } else {
      type = chooseTransactionType(rng);
    }

    const category = chooseCategory(
      rng,
      type,
    );

    const vendorId =
      type === "VENDOR_PAYOUT"
        ? chooseVendor(
            rng,
            vendors,
          ).id
        : rng.next() < 0.15
          ? chooseVendor(
              rng,
              vendors,
            ).id
          : null;

    const vendor =
      vendorId
        ? vendors.find(
            (item) => item.id === vendorId,
          ) ?? null
        : null;

    const date = monthWeightedDate(rng);

    const status =
      chooseTransactionStatus(rng);

    const amount = chooseAmount(
      rng,
      category,
    );

    const id = deterministicUuid(
      `${effectiveSeed}:transaction:${sequence}`,
    );

    const transaction: TransactionSeed = {
      id,
      reference: `SEED-${String(sequence).padStart(
        8,
        "0",
      )}`,
      date,
      vendorId,
      accountId: accountForTransaction(
        type,
        category,
        accountIds,
      ),
      amount: money(amount),
      currency: "INR",
      transactionType: type,
      category,
      status,
      description: descriptionFor(
        rng,
        type,
        category,
        vendor?.name ?? null,
      ),
      createdAt: randomDateTime(
        rng,
        date,
      ),
    };

    const reconciliation =
      createReconciliation(
        rng,
        transaction,
        sequence,
      );

    transactions.push(transaction);
    reconciliations.push(reconciliation);

    sequence += 1;
  }

  return {
    vendors,
    accounts,
    transactions,
    reconciliations,
    fixtureTransactions:
      fixtureData.transactions,
    fixtureReconciliations:
      fixtureData.reconciliations,
  };
}

function chooseVendor(
  rng: RNG,
  vendors: VendorSeed[],
): VendorSeed {
  /*
   * Deliberately non-uniform:
   *
   * 5 vendors: very high volume
   * 20 vendors: high/medium volume
   * 45 vendors: low/medium volume
   * 30 vendors: long tail
   */
  const weights = vendors.map(
    (_, index) => {
      if (index < 5) return 30;
      if (index < 25) return 10;
      if (index < 70) return 2;
      return 0.2;
    },
  );

  return rng.weighted(
    vendors,
    weights,
  );
}