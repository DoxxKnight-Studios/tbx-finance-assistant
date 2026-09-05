# TBX Finance Assistant - API

The backend for TBX Finance Assistant: an Express + TypeScript service that
answers natural-language finance questions about a single fictitious
company, **Northstar Technologies Pvt. Ltd.**, by grounding every answer in
a real PostgreSQL query over the official 3-table schema
(`bank` / `account` / `"transaction"`).

Gemini's job stops at recognizing *what* the user is asking. It never
writes SQL, never sees raw account numbers, and never computes a financial
result - every number in a response comes from PostgreSQL, by way of a
pre-written, parameterized query template.

See the [root README](../../README.md) for the full product/architecture
overview and the hackathon talking points. This file covers only the
backend.

## Stack

- Node.js + TypeScript, run directly via `tsx` in development
- Express 5 (`src/server.ts`)
- PostgreSQL via `pg` (`src/db/client.ts`)
- Gemini (`@google/genai`) for intent recognition only (`src/ai/gemini.ts`)
- `ajv` for schema-validating Gemini's structured output
- Vitest for tests

## Request flow

```
POST /api/chat { message, conversationContext? }
  -> ai/messagePipeline.ts: processFinanceMessage()
       -> ai/intentParser.ts calls Gemini with the message + prior
          conversation context, asking ONLY for one of 10 approved
          intents as structured JSON (src/ai/prompts/intent.ts)
       -> ai/validateIntent.ts re-validates that JSON at runtime against
          the FinanceIntent contract (src/ai/types.ts) - the TypeScript
          types alone are erased at runtime, so this is a real boundary,
          not just documentation
  -> query/queryPipeline.ts: executeFinanceIntent()
       -> query/queryPlanner.ts resolves bank/account/date-range filters
          into a QueryPlan (query/bankResolver.ts, accountResolver.ts,
          dateResolver.ts) - still no SQL, just resolved scoping values
       -> query/queryTemplateRegistry.ts picks ONE pre-written,
          parameterized SQL template per intent (query/queryTemplates.ts)
       -> query/queryExecutor.ts runs it against Postgres via pg.Pool
  -> response/responseFormatter.ts turns the plan + raw rows into the
     final answer/summary/evidence (and, on success, a "how this answer
     was derived" technical trace) - deterministically, with no further
     LLM call
```

Nothing in this path lets Gemini generate SQL, re-derive a financial
value, or influence the query beyond selecting one of the 10 approved
intents and their already-typed fields.

## Schema

`schema.sql` is a faithful PostgreSQL translation of the official
MySQL-style DDL for `bank`, `account`, and `"transaction"` (quoted because
`transaction` is easily confused with a reserved word). No logical
changes - same tables, columns, keys, and constraints - plus 4 minimal
indexes justified by the actual query workload (see the comments in the
file for why other indexes were deliberately not added).

Apply it against an empty database:

```bash
psql "$DATABASE_URL" -f schema.sql
```

`scripts/verify-schema.sql` runs a set of sanity checks against an
already-applied schema.

## Seed data

`npm run seed` (`src/seed/index.ts`) deterministically generates and loads
a fixed dataset for Northstar Technologies: 10 banks, 5 programs, 100
accounts, and exactly 50,000 transactions (35,000 debit / 15,000 credit),
using a seeded PRNG (`src/seed/rng.ts`, seed `20260905`) so the same
command always produces the same numbers. All money is generated and
stored in integer paise internally (`src/seed/money.ts`) and only ever
converted to a decimal string via string manipulation, never through
`Number()`, to avoid floating-point precision loss.

The generator deliberately engineers a few scenarios so the demo has
verifiable, memorable answers:
- August 2026 debit spend is materially higher than July 2026
- HDFC is the highest-spending bank; program `21` is the highest-spending program
- Exactly one transaction is the single largest, at ₹50,00,000.00
- 20 transactions use a `TXN-DEMO-*` reference id, for a guaranteed
  `transaction_lookup` demo
- 5 accounts are chosen to show a range of balances

`src/seed/verify.ts` re-checks the in-memory dataset against these
invariants before it's written to the database; `scripts/verify-seed.sql`
does the same against the database afterward.

## The 10 supported intents

Gemini may only ever return one of these (`src/ai/types.ts`,
`src/ai/prompts/intent.ts`). Anything else is rejected before it reaches
the query layer:

| Intent | What it answers |
|---|---|
| `transaction_spend_total` | Total debit amount, optionally by bank/program/account/date range |
| `transaction_income_total` | Total credit amount, optionally by bank/program/account/date range |
| `transaction_count` | Count of transactions, optionally filtered by type/bank/program/account/date range |
| `transaction_spend_by_bank` | Debit spend ranked by bank |
| `transaction_spend_by_program` | Debit spend ranked by program |
| `transaction_summary` | Count, debit total, credit total, and net for a scope |
| `largest_transaction` | The single largest transaction by amount |
| `transaction_lookup` | Looks up one transaction by its exact `transaction_reference_id` |
| `account_balance` | The available balance of one account, resolved by its last 4 digits |
| `financial_comparison` | Compares spend/income/count between two periods |

There is no vendor, category, reconciliation, or transaction-status
concept anywhere in this contract - those don't exist in the official
schema, so the intent/query/response layers don't model them.

## Conversation context (multi-turn)

`src/ai/conversationContext.ts` carries forward a flat bag of prior facts
(intent, date range, bank, program, account, transaction reference,
comparison) so a follow-up like "what about July?" can inherit the prior
turn's bank/account filter without re-stating it. It never lets a fact
silently carry into an unrelated intent; the prompt (`src/ai/prompts/intent.ts`)
spells out exactly when a fact should and shouldn't be inherited.

## Explainability ("how this answer was derived")

Every successful response optionally carries a `technical` field
(`TechnicalTrace`, defined in `src/response/responseFormatter.ts`) built
from the exact objects already produced by the real request - never a
second database query, never reconstructed:

- the validated `FinanceIntent` and the `QueryPlan` built from it
- the registered SQL template's text and the exact bound parameters
- a safe, read-only rendering of that SQL with the parameter values
  substituted in (`renderSqlWithBoundParams`) - explicitly **not** the
  execution mechanism; the real query still runs parameterized through `pg`
- the raw database rows (sanitized - see below)
- a short list of the deterministic transformation steps that turned
  those rows into the final answer

`sanitizeRowForTrace` strips exactly `account_number`, `utr_number`, and
`entity_id` from any row before it reaches this trace. Internal ids like
`account_id`/`transaction_id` are intentionally left in the trace (for
hackathon-judge debugging) but never appear in the public
`answer`/`summary`/`evidence` fields - see
`src/response/responseFormatter.test.ts`'s "technical trace" and
"security hardening" describe blocks for the regression tests covering
this, including a test that builds the account_balance intent's *real*
SQL template and asserts the SQL text legitimately names the
`account_number` column (to compute `last4` via `RIGHT()`) while the raw
account number value never appears anywhere.

## Evidence and response safety

`src/response/responseFormatter.ts` is the last line of defense before a
response leaves the API: it builds a typed, per-intent `FinanceEvidence`
shape and never forwards a raw database row. Account references are
always `last4` (`RIGHT(account_number, 4)`, computed in SQL - the full
column is never selected in the first place). `account_number`,
`utr_number`, and `entity_id` are never part of any response payload.

## Bank and account resolution

`query/bankResolver.ts` resolves a natural-language bank reference (exact
code, then exact name, then prefix match, case-insensitive) against the
`bank` table. `query/accountResolver.ts` resolves "account ending 1234"
by validating the input is exactly 4 digits, then querying with
`account_number LIKE $1` (matching the trailing 4 digits) and selecting
only `RIGHT(account_number, 4) AS last4`, so the full account number is
never pulled out of Postgres. Both return a `resolved` / `not_found` /
`ambiguous` result, which the query planner turns into a clarification
question when needed.

## Environment variables

See `.env.example`:

```
DATABASE_URL=
PORT=3000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
```

`DATABASE_URL` and `GEMINI_API_KEY` are required (`src/config/env.ts`
throws on startup if either is missing). `PORT` defaults to `3000`.
`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite` if unset.

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and GEMINI_API_KEY
psql "$DATABASE_URL" -f schema.sql
npm run seed
npm run dev
```

The server starts on `http://localhost:3000`. `GET /health` returns
`{ "status": "ok" }`; `GET /health/db` also checks the database
connection.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the API with `tsx watch` (auto-restart on change) |
| `npm run build` | Type-checks and compiles to `dist/` via `tsc -p tsconfig.build.json` |
| `npm start` | Runs the compiled `dist/server.js` |
| `npm run seed` | Generates and loads the deterministic seed dataset |
| `npm test` | Runs the Vitest suite |
| `npm run verify:gemini` | Manual/dev-only: makes real calls through the live Gemini-backed parser and the full deterministic pipeline against a set of scenarios, for a human to read - not part of `npm test` and not run in CI |
| `npm run test:validator` | Runs `tests/validator.test.ts` under Node's built-in `node:test` runner |

### The `test:validator` / `node:test` quirk

`tests/validator.test.ts` is written against Node's built-in `node:test`
API, not Vitest, and lives outside `src/` for that reason. Running the
whole-project `npm test` (Vitest) will report it as a failed suite with
"No test suite found in file" - that's Vitest correctly declining to run
a `node:test` file, not a real failure. Run it on its own with
`npm run test:validator` instead. This is a pre-existing, known quirk in
this repository, not something introduced by any recent change.

## Troubleshooting

- **"DATABASE_URL is not set" / "GEMINI_API_KEY is not set" on startup** -
  copy `.env.example` to `.env` and fill in both values.
- **`GET /health/db` returns `disconnected`** - confirm Postgres is
  running and `DATABASE_URL` points at a database with the schema
  already applied (`psql "$DATABASE_URL" -f schema.sql`).
- **Queries return no rows / seed-dependent demo questions don't match** -
  run `npm run seed` against the same database `DATABASE_URL` points at;
  the demo questions in the root README assume the seeded dataset.
- **`npm test` reports `tests/validator.test.ts` failed** - expected, see
  above; run `npm run test:validator` for that file specifically.
