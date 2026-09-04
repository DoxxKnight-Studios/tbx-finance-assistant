export const VENDOR_NAMES = [
  "Acme Corporation",
  "Globex Industries",
  "Stark Technologies",
  "Wayne Enterprises",
  "Umbrella Logistics",
  "Initech Solutions",
  "Hooli Systems",
  "Wonka Foods",
  "Massive Dynamic",
  "Soylent Manufacturing",
  "Cyberdyne Systems",
  "Vandelay Industries",
  "Prestige Worldwide",
  "Oceanic Trading",
  "Tyrell Computing",
  "Gringotts Financial",
  "Oscorp Industries",
  "Aperture Systems",
  "Duff Distribution",
  "Monarch Services",
  "Pied Piper Technologies",
  "Vehement Capital",
  "Dunder Supply Co",
  "Sterling Office Solutions",
  "Nakatomi Services",
  "Wonka Logistics",
  "LexCorp Solutions",
  "Gekko Trading",
  "InGen Research",
  "Cyberdyne Manufacturing",
  "Blue Sun Logistics",
  "Abstergo Industries",
  "Globex Consulting",
  "Stark Industrial Supplies",
  "Wayne Security",
  "Acme Office Solutions",
  "Hooli Cloud Services",
  "Umbrella Healthcare",
  "Massive Dynamic Labs",
  "Soylent Foods",
  "Vandelay Imports",
  "Prestige Consulting",
  "Oceanic Cargo",
  "Tyrell Data Systems",
  "Oscorp Labs",
  "Aperture Consulting",
  "Monarch Technologies",
  "Pied Piper Cloud",
  "Sterling Advisory",
  "Nakatomi Trading",
  "LexCorp Consulting",
  "Gekko Capital Services",
  "InGen Biotechnology",
  "Blue Sun Energy",
  "Abstergo Research",
  "Daily Planet Media",
  "Wonka Packaging",
  "Wayne Construction",
  "Stark Consulting",
  "Hooli Infrastructure",
  "Acme Industrial",
  "Umbrella Distribution",
  "Massive Dynamic Consulting",
  "Initech Support Services",
  "Globex Engineering",
  "Soylent Distribution",
  "Vandelay Consulting",
  "Prestige Events",
  "Oceanic Freight",
  "Tyrell Analytics",
  "Oscorp Engineering",
  "Aperture Robotics",
  "Monarch Distribution",
  "Pied Piper Analytics",
  "Sterling Technology",
  "Nakatomi Facilities",
  "LexCorp Industrial",
  "Gekko Advisory",
  "InGen Labs",
  "Blue Sun Manufacturing",
  "Abstergo Technologies",
  "Daily Planet Digital",
  "Wonka Ingredients",
  "Wayne Facilities",
  "Stark Infrastructure",
  "Hooli Security",
  "Acme Logistics",
  "Umbrella Consulting",
  "Massive Dynamic Security",
  "Initech Software",
  "Globex Logistics",
  "Soylent Manufacturing II",
  "Vandelay Office Supplies",
  "Prestige Logistics",
  "Oceanic Services",
  "Tyrell Consulting",
  "Oscorp Security",
  "Aperture Technologies",
  "Monarch Professional Services",
];

export const VENDOR_CATEGORIES = [
  "OFFICE_SUPPLIES",
  "SOFTWARE",
  "LOGISTICS",
  "RAW_MATERIALS",
  "PROFESSIONAL_SERVICES",
  "MARKETING",
  "TRAVEL",
  "UTILITIES",
  "FACILITIES",
  "MANUFACTURING",
];

export const TRANSACTION_CATEGORIES = [
  "OFFICE_SUPPLIES",
  "RAW_MATERIALS",
  "SOFTWARE",
  "LOGISTICS",
  "TRAVEL",
  "MARKETING",
  "PROFESSIONAL_SERVICES",
  "UTILITIES",
  "RENT",
  "INSURANCE",
  "TAX",
  "OTHER",
] as const;

export type TransactionCategory =
  (typeof TRANSACTION_CATEGORIES)[number];

export const TRANSACTION_TYPES = [
  "VENDOR_PAYOUT",
  "REFUND",
  "INTERNAL_TRANSFER",
  "FEE",
  "RECEIPT",
  "OTHER",
] as const;

export type TransactionType =
  (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = [
  "COMPLETED",
  "PENDING",
  "FAILED",
  "CANCELLED",
] as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUSES)[number];

export const RECONCILIATION_STATUSES = [
  "RECONCILED",
  "UNRECONCILED",
  "PARTIAL",
  "EXCEPTION",
] as const;

export type ReconciliationStatus =
  (typeof RECONCILIATION_STATUSES)[number];

export interface AccountDefinition {
  code: string;
  name: string;
  type:
    | "ASSET"
    | "LIABILITY"
    | "EQUITY"
    | "REVENUE"
    | "EXPENSE";
  parentCode: string | null;
}

export const ACCOUNTS: AccountDefinition[] = [
  {
    code: "1000",
    name: "Cash & Bank",
    type: "ASSET",
    parentCode: null,
  },
  {
    code: "1010",
    name: "Operating Bank Account",
    type: "ASSET",
    parentCode: "1000",
  },
  {
    code: "1020",
    name: "Petty Cash",
    type: "ASSET",
    parentCode: "1000",
  },
  {
    code: "1100",
    name: "Accounts Receivable",
    type: "ASSET",
    parentCode: null,
  },
  {
    code: "1200",
    name: "Prepaid Expenses",
    type: "ASSET",
    parentCode: null,
  },
  {
    code: "1300",
    name: "Equipment",
    type: "ASSET",
    parentCode: null,
  },
  {
    code: "2000",
    name: "Accounts Payable",
    type: "LIABILITY",
    parentCode: null,
  },
  {
    code: "2100",
    name: "Accrued Expenses",
    type: "LIABILITY",
    parentCode: null,
  },
  {
    code: "2200",
    name: "Tax Payable",
    type: "LIABILITY",
    parentCode: null,
  },
  {
    code: "2300",
    name: "Short Term Debt",
    type: "LIABILITY",
    parentCode: null,
  },
  {
    code: "3000",
    name: "Common Equity",
    type: "EQUITY",
    parentCode: null,
  },
  {
    code: "3100",
    name: "Retained Earnings",
    type: "EQUITY",
    parentCode: null,
  },
  {
    code: "4000",
    name: "Operating Revenue",
    type: "REVENUE",
    parentCode: null,
  },
  {
    code: "4100",
    name: "Service Revenue",
    type: "REVENUE",
    parentCode: "4000",
  },
  {
    code: "4200",
    name: "Product Revenue",
    type: "REVENUE",
    parentCode: "4000",
  },
  {
    code: "5000",
    name: "Operating Expenses",
    type: "EXPENSE",
    parentCode: null,
  },
  {
    code: "5100",
    name: "Office Supplies",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5200",
    name: "Software & SaaS",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5300",
    name: "Logistics & Freight",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5400",
    name: "Travel & Accommodation",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5500",
    name: "Marketing",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5600",
    name: "Professional Services",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5700",
    name: "Utilities",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5800",
    name: "Rent & Facilities",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "5900",
    name: "Insurance",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "6000",
    name: "Taxes & Government Fees",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "6100",
    name: "Bank & Payment Fees",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "6200",
    name: "Refunds & Adjustments",
    type: "EXPENSE",
    parentCode: "5000",
  },
  {
    code: "6300",
    name: "Miscellaneous Expense",
    type: "EXPENSE",
    parentCode: "5000",
  },
];