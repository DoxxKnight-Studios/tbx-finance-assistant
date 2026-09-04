-- ============================================================
-- TBX Finance Assistant - Seed Verification
-- ============================================================


-- ------------------------------------------------------------
-- 1. Overall row counts
-- ------------------------------------------------------------

SELECT
    'vendors' AS table_name,
    COUNT(*) AS row_count
FROM vendors

UNION ALL

SELECT
    'accounts',
    COUNT(*)
FROM accounts

UNION ALL

SELECT
    'transactions',
    COUNT(*)
FROM transactions

UNION ALL

SELECT
    'reconciliations',
    COUNT(*)
FROM reconciliations;


-- ------------------------------------------------------------
-- 2. Every seeded transaction must have exactly one
--    reconciliation
-- ------------------------------------------------------------

SELECT
    COUNT(*) AS transactions_without_reconciliation
FROM transactions t
LEFT JOIN reconciliations r
    ON r.transaction_id = t.id
WHERE
    (
        t.transaction_reference LIKE 'SEED-%'
        OR t.transaction_reference LIKE 'TEST-%'
    )
    AND r.id IS NULL;


SELECT
    COUNT(*) AS transactions_with_multiple_reconciliations
FROM transactions t
JOIN reconciliations r
    ON r.transaction_id = t.id
WHERE
    t.transaction_reference LIKE 'SEED-%'
    OR t.transaction_reference LIKE 'TEST-%'
GROUP BY t.id
HAVING COUNT(r.id) > 1;


-- ------------------------------------------------------------
-- 3. Foreign-key relationship validation
-- ------------------------------------------------------------

SELECT COUNT(*) AS orphan_vendor_transactions
FROM transactions t
LEFT JOIN vendors v
    ON v.id = t.vendor_id
WHERE
    t.vendor_id IS NOT NULL
    AND v.id IS NULL;


SELECT COUNT(*) AS orphan_account_transactions
FROM transactions t
LEFT JOIN accounts a
    ON a.id = t.account_id
WHERE a.id IS NULL;


SELECT COUNT(*) AS orphan_reconciliations
FROM reconciliations r
LEFT JOIN transactions t
    ON t.id = r.transaction_id
WHERE t.id IS NULL;


-- ------------------------------------------------------------
-- 4. Currency validation
-- ------------------------------------------------------------

SELECT
    currency,
    COUNT(*) AS count
FROM transactions
GROUP BY currency;


SELECT
    currency,
    COUNT(*) AS count
FROM accounts
GROUP BY currency;


-- ------------------------------------------------------------
-- 5. Monthly transaction volume
-- ------------------------------------------------------------

SELECT
    DATE_TRUNC(
        'month',
        transaction_date
    )::date AS month,
    COUNT(*) AS transaction_count,
    SUM(amount) AS total_amount
FROM transactions
WHERE transaction_date
    BETWEEN DATE '2026-01-01'
    AND DATE '2026-08-31'
GROUP BY 1
ORDER BY 1;


-- ------------------------------------------------------------
-- 6. August vs July total spend
-- ------------------------------------------------------------

SELECT
    SUM(
        CASE
            WHEN transaction_date >= DATE '2026-08-01'
             AND transaction_date < DATE '2026-09-01'
            THEN amount
            ELSE 0
        END
    ) AS august_spend,

    SUM(
        CASE
            WHEN transaction_date >= DATE '2026-07-01'
             AND transaction_date < DATE '2026-08-01'
            THEN amount
            ELSE 0
        END
    ) AS july_spend
FROM transactions;


-- ------------------------------------------------------------
-- 7. Vendor payout comparison
-- ------------------------------------------------------------

SELECT
    v.name AS vendor,

    SUM(
        CASE
            WHEN t.transaction_date >= DATE '2026-08-01'
             AND t.transaction_date < DATE '2026-09-01'
            THEN t.amount
            ELSE 0
        END
    ) AS august_payouts,

    SUM(
        CASE
            WHEN t.transaction_date >= DATE '2026-07-01'
             AND t.transaction_date < DATE '2026-08-01'
            THEN t.amount
            ELSE 0
        END
    ) AS july_payouts

FROM transactions t
JOIN vendors v
    ON v.id = t.vendor_id

WHERE
    t.transaction_type = 'VENDOR_PAYOUT'
    AND t.transaction_date
        BETWEEN DATE '2026-07-01'
        AND DATE '2026-08-31'

GROUP BY v.id, v.name
ORDER BY august_payouts DESC;


-- ------------------------------------------------------------
-- 8. Top vendors by total spend
-- ------------------------------------------------------------

SELECT
    v.vendor_code,
    v.name,
    COUNT(t.id) AS transaction_count,
    SUM(t.amount) AS total_spend
FROM vendors v
JOIN transactions t
    ON t.vendor_id = v.id
GROUP BY
    v.id,
    v.vendor_code,
    v.name
ORDER BY total_spend DESC
LIMIT 20;


-- ------------------------------------------------------------
-- 9. Reconciliation distribution
-- ------------------------------------------------------------

SELECT
    r.status,
    COUNT(*) AS count,
    ROUND(
        COUNT(*) * 100.0 /
        SUM(COUNT(*)) OVER (),
        2
    ) AS percentage
FROM reconciliations r
JOIN transactions t
    ON t.id = r.transaction_id
WHERE
    t.transaction_reference LIKE 'SEED-%'
    OR t.transaction_reference LIKE 'TEST-%'
GROUP BY r.status
ORDER BY count DESC;


-- ------------------------------------------------------------
-- 10. Transaction status distribution
-- ------------------------------------------------------------

SELECT
    status,
    COUNT(*) AS count,
    ROUND(
        COUNT(*) * 100.0 /
        SUM(COUNT(*)) OVER (),
        2
    ) AS percentage
FROM transactions
WHERE
    transaction_reference LIKE 'SEED-%'
    OR transaction_reference LIKE 'TEST-%'
GROUP BY status
ORDER BY count DESC;


-- ------------------------------------------------------------
-- 11. Large transactions
-- ------------------------------------------------------------

SELECT
    t.transaction_reference,
    t.transaction_date,
    v.name AS vendor,
    t.transaction_type,
    t.amount,
    t.status,
    r.status AS reconciliation_status
FROM transactions t
LEFT JOIN vendors v
    ON v.id = t.vendor_id
JOIN reconciliations r
    ON r.transaction_id = t.id
WHERE
    t.amount >= 1000000
ORDER BY t.amount DESC;


-- ------------------------------------------------------------
-- 12. Unreconciled transactions
-- ------------------------------------------------------------

SELECT
    t.transaction_reference,
    t.transaction_date,
    v.name AS vendor,
    t.amount,
    r.status,
    r.difference_amount
FROM transactions t
LEFT JOIN vendors v
    ON v.id = t.vendor_id
JOIN reconciliations r
    ON r.transaction_id = t.id
WHERE r.status = 'UNRECONCILED'
ORDER BY t.amount DESC
LIMIT 50;


-- ------------------------------------------------------------
-- 13. Reconciliation arithmetic validation
-- ------------------------------------------------------------

SELECT COUNT(*) AS invalid_reconciliation_math
FROM transactions t
JOIN reconciliations r
    ON r.transaction_id = t.id
WHERE
    r.status = 'PARTIAL'
    AND ROUND(
        r.reconciled_amount +
        r.difference_amount,
        2
    ) <> ROUND(t.amount, 2);


-- ------------------------------------------------------------
-- 14. Deterministic Acme fixture
-- ------------------------------------------------------------

SELECT
    t.transaction_reference,
    t.transaction_date,
    t.amount,
    t.status AS transaction_status,
    r.status AS reconciliation_status,
    r.reconciled_amount,
    r.difference_amount
FROM transactions t
JOIN vendors v
    ON v.id = t.vendor_id
JOIN reconciliations r
    ON r.transaction_id = t.id
WHERE
    v.vendor_code = 'TEST-VENDOR-ACME'
ORDER BY t.transaction_date;


-- ------------------------------------------------------------
-- 15. Deterministic August/July Acme totals
-- ------------------------------------------------------------

SELECT
    SUM(
        CASE
            WHEN t.transaction_date >= DATE '2026-08-01'
             AND t.transaction_date < DATE '2026-09-01'
            THEN t.amount
            ELSE 0
        END
    ) AS august_total,

    SUM(
        CASE
            WHEN t.transaction_date >= DATE '2026-07-01'
             AND t.transaction_date < DATE '2026-08-01'
            THEN t.amount
            ELSE 0
        END
    ) AS july_total,

    SUM(
        CASE
            WHEN t.transaction_date >= DATE '2026-08-01'
             AND t.transaction_date < DATE '2026-09-01'
            THEN t.amount
            ELSE 0
        END
    )
    -
    SUM(
        CASE
            WHEN t.transaction_date >= DATE '2026-07-01'
             AND t.transaction_date < DATE '2026-08-01'
            THEN t.amount
            ELSE 0
        END
    ) AS august_minus_july

FROM transactions t
JOIN vendors v
    ON v.id = t.vendor_id
WHERE
    v.vendor_code = 'TEST-VENDOR-ACME';


-- ------------------------------------------------------------
-- 16. Vendors with high transaction volume
-- ------------------------------------------------------------

SELECT
    v.name,
    COUNT(*) AS transaction_count,
    SUM(t.amount) AS total_amount
FROM transactions t
JOIN vendors v
    ON v.id = t.vendor_id
GROUP BY v.id, v.name
ORDER BY transaction_count DESC
LIMIT 20;


-- ------------------------------------------------------------
-- 17. Vendors with very low transaction volume
-- ------------------------------------------------------------

SELECT
    v.name,
    COUNT(*) AS transaction_count,
    SUM(t.amount) AS total_amount
FROM transactions t
JOIN vendors v
    ON v.id = t.vendor_id
GROUP BY v.id, v.name
ORDER BY transaction_count ASC
LIMIT 20;