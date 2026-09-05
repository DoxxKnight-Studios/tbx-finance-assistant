-- ============================================================
-- TBX Finance Assistant - Schema Verification
-- ============================================================
-- Read-only structural checks against information_schema/pg_catalog.
-- No data is required for this script - it verifies apps/api/schema.sql
-- was applied correctly to an (optionally empty) database.


-- ------------------------------------------------------------
-- 1. Exactly the three official application tables exist
-- ------------------------------------------------------------

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- ------------------------------------------------------------
-- 2. Columns for each table (name, type, nullability, default)
-- ------------------------------------------------------------

SELECT
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    datetime_precision,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('bank', 'account', 'transaction')
ORDER BY table_name, ordinal_position;


-- ------------------------------------------------------------
-- 3. Primary keys
-- ------------------------------------------------------------

SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('bank', 'account', 'transaction')
ORDER BY tc.table_name;


-- ------------------------------------------------------------
-- 4. Foreign keys
-- ------------------------------------------------------------

SELECT
    tc.table_name AS referencing_table,
    kcu.column_name AS referencing_column,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ------------------------------------------------------------
-- 5. transaction_type CHECK constraint (credit/debit only)
-- ------------------------------------------------------------

SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'transaction'
  AND con.contype = 'c';

-- Behavioral proof: valid values are accepted, invalid values are
-- rejected, all inside a rolled-back transaction (no rows persist).
DO $$
BEGIN
    BEGIN
        INSERT INTO bank (bank_code, bank_name)
        VALUES ('ZZTEST', 'Verification Bank Temp');

        INSERT INTO account (
            account_id, entity_id, account_number,
            program_id, available_balance, bank_code
        )
        VALUES (
            'zztest-acct', 'zztest-entity', '0000000000',
            1, 0.00, 'ZZTEST'
        );

        INSERT INTO "transaction" (
            transaction_id, account_id, transaction_date,
            transaction_type, transaction_amount
        )
        VALUES (
            'zztest-txn-credit', 'zztest-acct', now(),
            'credit', 100.00
        );

        INSERT INTO "transaction" (
            transaction_id, account_id, transaction_date,
            transaction_type, transaction_amount
        )
        VALUES (
            'zztest-txn-debit', 'zztest-acct', now(),
            'debit', 50.00
        );

        RAISE NOTICE 'CHECK constraint test: credit/debit accepted as expected.';

        BEGIN
            INSERT INTO "transaction" (
                transaction_id, account_id, transaction_date,
                transaction_type, transaction_amount
            )
            VALUES (
                'zztest-txn-invalid', 'zztest-acct', now(),
                'refund', 1.00
            );

            RAISE EXCEPTION 'CHECK constraint test FAILED: invalid transaction_type was accepted.';
        EXCEPTION
            WHEN check_violation THEN
                RAISE NOTICE 'CHECK constraint test: invalid transaction_type correctly rejected.';
        END;

        RAISE EXCEPTION 'rollback_verification_data';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'rollback_verification_data' THEN
                RAISE NOTICE 'Verification rows rolled back - database left unchanged.';
            ELSE
                RAISE;
            END IF;
    END;
END $$;


-- ------------------------------------------------------------
-- 6. account.available_balance: NUMERIC(15,2) DEFAULT 0.00
-- ------------------------------------------------------------

SELECT
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'account'
  AND column_name = 'available_balance';


-- ------------------------------------------------------------
-- 7. transaction.transaction_amount: NUMERIC(15,2) DEFAULT 0.00
-- ------------------------------------------------------------

SELECT
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transaction'
  AND column_name = 'transaction_amount';


-- ------------------------------------------------------------
-- 8. transaction.transaction_date: microsecond precision (6)
-- ------------------------------------------------------------

SELECT
    column_name,
    data_type,
    datetime_precision
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transaction'
  AND column_name = 'transaction_date';


-- ------------------------------------------------------------
-- 9. No old-schema tables exist
-- ------------------------------------------------------------

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vendors', 'accounts', 'transactions', 'reconciliations');
-- Expect 0 rows.


-- ------------------------------------------------------------
-- 10. Indexes present
-- ------------------------------------------------------------

SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('bank', 'account', 'transaction')
ORDER BY tablename, indexname;
