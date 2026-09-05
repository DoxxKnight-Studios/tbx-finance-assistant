-- ============================================================
-- TBX Finance Assistant - Official Schema (PostgreSQL)
-- ============================================================
--
-- Faithful PostgreSQL translation of the official TBX schema
-- (originally specified with MySQL-specific syntax: ENGINE=InnoDB,
-- CHARSET=utf8mb4, ENUM(...)). No logical change: same three tables,
-- same columns, same keys, same constraints.
--
-- Safe to run against an empty database. Creates exactly the three
-- application tables (bank, account, "transaction") plus a minimal
-- set of indexes for the approved query workload. Contains no seed
-- data and no compatibility objects for the old (pre-TBX) schema.
--
-- Translation notes:
--   - ENUM('credit','debit')  -> VARCHAR(6) + CHECK constraint
--   - DECIMAL(15,2)           -> NUMERIC(15,2) (identical in Postgres)
--   - TIMESTAMP(6)            -> TIMESTAMP(6) (native microsecond precision)
--   - `transaction` is a non-reserved-but-easily-confused identifier,
--     so every reference is double-quoted consistently.
-- ============================================================

CREATE TABLE bank (
    bank_code VARCHAR(10) PRIMARY KEY,
    bank_name VARCHAR(150) NOT NULL
);

CREATE TABLE account (
    account_id VARCHAR(36) PRIMARY KEY,
    entity_id VARCHAR(36) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    program_id INT NOT NULL,
    available_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    bank_code VARCHAR(10) NOT NULL,
    FOREIGN KEY (bank_code) REFERENCES bank (bank_code)
);

CREATE TABLE "transaction" (
    transaction_id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL,
    transaction_date TIMESTAMP(6) NOT NULL,
    transaction_type VARCHAR(6) NOT NULL
        CHECK (transaction_type IN ('credit', 'debit')),
    description VARCHAR(500) DEFAULT NULL,
    transaction_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    transaction_reference_id VARCHAR(64) DEFAULT NULL,
    utr_number VARCHAR(256) DEFAULT NULL,
    FOREIGN KEY (account_id) REFERENCES account (account_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
-- Minimal set only - 50,000 transactions does not need heavy
-- indexing, so each one below is justified by a specific approved
-- intent rather than added speculatively.

-- FK join column, not auto-indexed by Postgres (only the referenced
-- PK side is). Needed for transaction_spend_by_bank, which must join
-- "transaction" -> account -> bank.
CREATE INDEX idx_account_bank_code ON account (bank_code);

-- FK join column, not auto-indexed by Postgres. Needed for every
-- intent that joins "transaction" back to account (transaction_spend_by_bank,
-- transaction_spend_by_program, account_balance evidence).
CREATE INDEX idx_transaction_account_id ON "transaction" (account_id);

-- Nearly every approved intent (spend/income totals, count, summary,
-- largest_transaction, financial_comparison) filters on a date range -
-- this is the single most-hit predicate in the workload.
CREATE INDEX idx_transaction_date ON "transaction" (transaction_date);

-- transaction_lookup is an exact-match lookup on this column.
CREATE INDEX idx_transaction_reference_id
    ON "transaction" (transaction_reference_id);

-- Deliberately NOT indexed:
--   - transaction.transaction_type: only 2 distinct values: a
--     standalone index has poor selectivity and won't help a filter
--     that already scans a 50k-row table in a few ms; if it matters
--     later it belongs in a composite index with transaction_date,
--     not on its own.
--   - account.program_id: the approved dataset has only 5 programs
--     across 100 accounts - grouping over a 100-row table needs no
--     index.
--   - account.account_number: account_balance resolves accounts by
--     masked/last-4 (a leading-wildcard LIKE '%1234' match), which a
--     plain B-tree index cannot accelerate anyway.
