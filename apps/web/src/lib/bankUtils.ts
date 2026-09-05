export interface BankVisual {
  code: string;
  name: string;
  shortName: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  gradientClass: string;
}

/**
 * Normalizes shouting all-caps bank names into clean, readable titles.
 */
export function formatBankName(name?: string, code?: string): string {
  if (!name && !code) return "Unknown Bank";
  const raw = (name || code || "").trim();
  const normalized = raw.toUpperCase();

  if (normalized.includes("HDFC")) return "HDFC Bank";
  if (normalized.includes("ICICI")) return "ICICI Bank";
  if (normalized.includes("AXIS")) return "Axis Bank";
  if (normalized.includes("KOTAK")) return "Kotak Mahindra Bank";
  if (normalized.includes("CANARA")) return "Canara Bank";
  if (normalized.includes("UNION BANK")) return "Union Bank of India";
  if (normalized.includes("STATE BANK") || normalized.includes("SBI")) {
    return "State Bank of India";
  }

  // General clean title-casing
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/**
 * Returns branded visual styling for recognized banks.
 */
export function getBankVisual(name?: string, code?: string): BankVisual {
  const normalized = (name || code || "").toUpperCase();

  if (normalized.includes("HDFC")) {
    return {
      code: "HDFC",
      name: formatBankName(name, code),
      shortName: "HDFC",
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
      borderClass: "border-blue-500/30",
      gradientClass: "from-blue-600 to-indigo-600",
    };
  }

  if (normalized.includes("ICICI")) {
    return {
      code: "ICICI",
      name: formatBankName(name, code),
      shortName: "ICICI",
      colorClass: "text-orange-600 dark:text-orange-400",
      bgClass: "bg-orange-500/10 dark:bg-orange-500/20",
      borderClass: "border-orange-500/30",
      gradientClass: "from-orange-500 to-amber-600",
    };
  }

  if (normalized.includes("AXIS")) {
    return {
      code: "AXIS",
      name: formatBankName(name, code),
      shortName: "Axis",
      colorClass: "text-rose-600 dark:text-rose-400",
      bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
      borderClass: "border-rose-500/30",
      gradientClass: "from-rose-600 to-pink-600",
    };
  }

  if (normalized.includes("CANARA")) {
    return {
      code: "CANARA",
      name: formatBankName(name, code),
      shortName: "Canara",
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
      borderClass: "border-amber-500/30",
      gradientClass: "from-amber-500 to-yellow-600",
    };
  }

  if (normalized.includes("UNION")) {
    return {
      code: "UNION",
      name: formatBankName(name, code),
      shortName: "Union",
      colorClass: "text-cyan-600 dark:text-cyan-400",
      bgClass: "bg-cyan-500/10 dark:bg-cyan-500/20",
      borderClass: "border-cyan-500/30",
      gradientClass: "from-cyan-600 to-blue-600",
    };
  }

  if (normalized.includes("KOTAK")) {
    return {
      code: "KOTAK",
      name: formatBankName(name, code),
      shortName: "Kotak",
      colorClass: "text-red-600 dark:text-red-400",
      bgClass: "bg-red-500/10 dark:bg-red-500/20",
      borderClass: "border-red-500/30",
      gradientClass: "from-red-600 to-rose-600",
    };
  }

  if (normalized.includes("STATE") || normalized.includes("SBI")) {
    return {
      code: "SBI",
      name: formatBankName(name, code),
      shortName: "SBI",
      colorClass: "text-sky-600 dark:text-sky-400",
      bgClass: "bg-sky-500/10 dark:bg-sky-500/20",
      borderClass: "border-sky-500/30",
      gradientClass: "from-sky-600 to-indigo-600",
    };
  }

  const shortCode = (code || name || "BANK").slice(0, 4).toUpperCase();
  return {
    code: shortCode,
    name: formatBankName(name, code),
    shortName: shortCode,
    colorClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-border",
    gradientClass: "from-primary to-primary/80",
  };
}
