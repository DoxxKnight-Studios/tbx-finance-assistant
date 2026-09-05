-- ============================================================
-- TBX Finance Assistant - Seed Verification (Phase 3 dataset)
-- ============================================================
-- Verifies the new official dataset (bank/account/"transaction" only).
-- Does not check for, or reference, the old vendor/reconciliation
-- schema in any way - that dataset no longer exists.


-- ------------------------------------------------------------
-- 1. Row counts
-- ------------------------------------------------------------

SELECT 'bank' AS table_name, COUNT(*) AS row_count FROM bank
UNION ALL
SELECT 'account', COUNT(*) FROM account
UNION ALL
SELECT 'transaction', COUNT(*) FROM "transaction";
-- Expect: bank=10, account=100, transaction=50000


-- ------------------------------------------------------------
-- 2. Debit / credit split
-- ------------------------------------------------------------

SELECT transaction_type, COUNT(*) AS row_count
FROM "transaction"
GROUP BY transaction_type
ORDER BY transaction_type;
-- Expect: credit=15000, debit=35000


-- ------------------------------------------------------------
-- 3. Account distribution by bank
-- ------------------------------------------------------------

SELECT b.bank_code, b.bank_name, COUNT(a.account_id) AS account_count
FROM bank b
LEFT JOIN account a ON a.bank_code = b.bank_code
GROUP BY b.bank_code, b.bank_name
ORDER BY account_count DESC;
-- Expect: HDFC 18, ICIC 15, SBIN 13, UTIB 12, KKBK 10, CNRB 9, UBIN 8, AUBL 6, TMBL 5, RATN 4


-- ------------------------------------------------------------
-- 4. Account distribution by program
-- ------------------------------------------------------------

SELECT program_id, COUNT(*) AS account_count
FROM account
GROUP BY program_id
ORDER BY account_count DESC;
-- Expect: 21->28, 4->24, 46->20, 33->16, 58->12


-- ------------------------------------------------------------
-- 5. Date range
-- ------------------------------------------------------------

SELECT MIN(transaction_date) AS earliest, MAX(transaction_date) AS latest
FROM "transaction";
-- Expect: earliest >= 2025-01-01 00:00:00, latest <= 2026-08-31 23:59:59.999999


-- ------------------------------------------------------------
-- 6. Duplicate references / IDs (should all return 0 rows)
-- ------------------------------------------------------------

SELECT transaction_reference_id, COUNT(*)
FROM "transaction"
WHERE transaction_reference_id IS NOT NULL
GROUP BY transaction_reference_id
HAVING COUNT(*) > 1;

SELECT transaction_id, COUNT(*)
FROM "transaction"
GROUP BY transaction_id
HAVING COUNT(*) > 1;

SELECT account_number, COUNT(*)
FROM account
GROUP BY account_number
HAVING COUNT(*) > 1;

SELECT RIGHT(account_number, 4) AS last4, COUNT(*)
FROM account
GROUP BY last4
HAVING COUNT(*) > 1;


-- ------------------------------------------------------------
-- 7. UTR: some populated, some NULL
-- ------------------------------------------------------------

SELECT
    COUNT(*) FILTER (WHERE utr_number IS NOT NULL) AS utr_present,
    COUNT(*) FILTER (WHERE utr_number IS NULL) AS utr_null
FROM "transaction";


-- ------------------------------------------------------------
-- 8. Largest transaction (must be unique)
-- ------------------------------------------------------------

SELECT transaction_id, transaction_amount, transaction_type, transaction_date, account_id
FROM "transaction"
ORDER BY transaction_amount DESC
LIMIT 3;
-- Expect the #1 row's amount to be strictly greater than #2's (no tie).


-- ------------------------------------------------------------
-- 9. July vs August 2026 debit spend
-- ------------------------------------------------------------

SELECT
    SUM(transaction_amount) FILTER (
        WHERE transaction_type = 'debit'
          AND transaction_date >= '2026-07-01' AND transaction_date < '2026-08-01'
    ) AS july_2026_debit_total,
    SUM(transaction_amount) FILTER (
        WHERE transaction_type = 'debit'
          AND transaction_date >= '2026-08-01' AND transaction_date < '2026-09-01'
    ) AS august_2026_debit_total
FROM "transaction";
-- Expect august ~= 1.20x-1.30x july


-- ------------------------------------------------------------
-- 10. Bank debit spend ranking (HDFC should lead)
-- ------------------------------------------------------------

SELECT a.bank_code, SUM(t.transaction_amount) AS total_debit
FROM "transaction" t
JOIN account a ON a.account_id = t.account_id
WHERE t.transaction_type = 'debit'
GROUP BY a.bank_code
ORDER BY total_debit DESC;


-- ------------------------------------------------------------
-- 11. Program debit spend ranking (program 21 should lead)
-- ------------------------------------------------------------

SELECT a.program_id, SUM(t.transaction_amount) AS total_debit
FROM "transaction" t
JOIN account a ON a.account_id = t.account_id
WHERE t.transaction_type = 'debit'
GROUP BY a.program_id
ORDER BY total_debit DESC;


-- ------------------------------------------------------------
-- 12. Balance variety and implied opening balance
-- ------------------------------------------------------------
-- The official schema stores no opening_balance column, so the full
-- "available_balance = opening + credits - debits" identity is proven
-- application-side at generation time (src/seed/verify.ts), not here.
-- This query instead derives what each account's opening balance MUST
-- have been for its current available_balance to be internally
-- consistent, which is useful for manual spot-checking.

SELECT
    a.account_id,
    RIGHT(a.account_number, 4) AS last4,
    a.bank_code,
    a.program_id,
    a.available_balance,
    COALESCE(SUM(t.transaction_amount) FILTER (WHERE t.transaction_type = 'credit'), 0) AS total_credits,
    COALESCE(SUM(t.transaction_amount) FILTER (WHERE t.transaction_type = 'debit'), 0) AS total_debits,
    a.available_balance
        - COALESCE(SUM(t.transaction_amount) FILTER (WHERE t.transaction_type = 'credit'), 0)
        + COALESCE(SUM(t.transaction_amount) FILTER (WHERE t.transaction_type = 'debit'), 0)
        AS implied_opening_balance
FROM account a
LEFT JOIN "transaction" t ON t.account_id = a.account_id
GROUP BY a.account_id, a.account_number, a.bank_code, a.program_id, a.available_balance
ORDER BY a.available_balance DESC;


-- ------------------------------------------------------------
-- 13. Demo references
-- ------------------------------------------------------------

SELECT transaction_reference_id, transaction_date, transaction_type, transaction_amount, account_id
FROM "transaction"
WHERE transaction_reference_id LIKE 'TXN-DEMO-%'
ORDER BY transaction_reference_id;
-- Expect exactly 20 rows: TXN-DEMO-000001 .. TXN-DEMO-000020


-- ------------------------------------------------------------
-- 14. Referential integrity (should return 0 rows each)
-- ------------------------------------------------------------

SELECT t.transaction_id
FROM "transaction" t
LEFT JOIN account a ON a.account_id = t.account_id
WHERE a.account_id IS NULL;

SELECT a.account_id
FROM account a
LEFT JOIN bank b ON b.bank_code = a.bank_code
WHERE b.bank_code IS NULL;


-- ------------------------------------------------------------
-- 15. No old-schema tables exist
-- ------------------------------------------------------------

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vendors', 'accounts', 'transactions', 'reconciliations');
-- Expect 0 rows.
