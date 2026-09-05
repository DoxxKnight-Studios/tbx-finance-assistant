# TBX Finance Assistant

A natural-language finance chatbot for a single fictitious company,
**Northstar Technologies Pvt. Ltd.**, built over an official 3-table
PostgreSQL schema (`bank` / `account` / `"transaction"`). Ask it things
like "How much did we spend in August 2026?" or "What is the balance of
account ending 7622?" and it answers from the real, seeded transaction
data - never a guess, never an LLM-computed number.

This is a hackathon project. The core design bet: **an LLM should decide
what the user is asking, never what the answer is.** Gemini recognizes
one of 10 approved intents and extracts its structured fields; every
number in the response comes from PostgreSQL, through a pre-written,
parameterized SQL query, run and formatted deterministically.

## Repository layout

```
apps/
  api/     Express + TypeScript backend (Postgres, Gemini intent
           recognition, deterministic query pipeline, response
           formatting) - see apps/api/README.md
  web/     React + TypeScript frontend (chat UI) - see apps/web/README.md
```

## Architecture

```
User question
  -> Gemini recognizes ONE of 10 approved intents, extracts only their
     already-typed fields (bank code, date range, last-4, ...) - never SQL,
     never a computed value
  -> The intent is re-validated at runtime against a strict TypeScript
     contract (illegal fields like vendor/category/reconciliation are
     rejected here, not just at compile time)
  -> A deterministic query planner resolves bank/account names and
     relative dates into concrete scoping values
  -> ONE of 10 pre-written, parameterized SQL templates is selected by
     intent name and run against PostgreSQL - Gemini never sees or writes
     this query
  -> The raw database rows are turned into the final answer, summary, and
     evidence by a deterministic formatter - no further LLM call
```

The full request flow, file-by-file, is documented in
[`apps/api/README.md`](apps/api/README.md).

### Why SQL is registered, not generated

Nothing here does text-to-SQL. Gemini's output is checked against a
closed, discriminated-union `FinanceIntent` type before it can influence
anything, and each of the 10 intents maps to exactly one hand-written SQL
template (`apps/api/src/query/queryTemplates.ts`). A malformed or
unexpected question either resolves to one of those 10 intents correctly,
or is rejected as unsupported/needing clarification - there is no code
path where an LLM's freeform text becomes a query.

### Why not RAG

There's nothing to retrieve. The domain is three tables and a fixed set
of aggregate questions over them - the answer to "how much did we spend"
is a `SUM`, not a passage of text to find and summarize. A vector index
over transaction rows would add a whole subsystem (embeddings, chunking,
similarity search) to solve a problem SQL's `GROUP BY`/`SUM`/`WHERE`
already solves exactly, with the added risk of the LLM paraphrasing a
number instead of returning the one PostgreSQL actually computed.

### Deterministic grounding

- Gemini decides the intent and its fields.
- Validation, resolution, planning, and SQL execution are all
  deterministic - no LLM in that path.
- The response formatter turns trusted database rows into the final
  answer deterministically - no second LLM call rewrites or restates the
  numbers.

## The 10 supported intents

`transaction_spend_total`, `transaction_income_total`,
`transaction_count`, `transaction_spend_by_bank`,
`transaction_spend_by_program`, `transaction_summary`,
`largest_transaction`, `transaction_lookup`, `account_balance`,
`financial_comparison`. See `apps/api/README.md` for what each one
answers and its exact fields. There is no vendor, category,
reconciliation, or transaction-status concept anywhere in this system -
those don't exist in the official schema.

## Schema

Three tables only: `bank`, `account`, `"transaction"` (quoted -
`transaction` is easily confused with a reserved word). See
`apps/api/schema.sql` for the full faithful PostgreSQL translation of the
official DDL, and `apps/api/README.md` for how to apply it.

## Dataset

A deterministic seed (`npm run seed` in `apps/api`, seed `20260905`)
generates and loads:

- 10 banks, 5 programs, 100 accounts, 1 entity (Northstar Technologies)
- 50,000 transactions: 35,000 debit / 15,000 credit
- August 2026 debit spend materially exceeds July 2026's
- HDFC is the highest-spending bank; program `21` is the highest-spending program
- Exactly one transaction is the single largest, at ₹50,00,000.00
- 20 transactions carry a `TXN-DEMO-*` reference id for a guaranteed lookup demo
- 5 accounts are chosen to show a range of balances

## Canonical demo questions

These are the 10 sample questions shown in the UI
(`apps/web/src/lib/suggestions.ts`), with their expected answers verified
directly against the seeded database at time of writing:

| Question | Verified answer |
|---|---|
| How much did we spend in August 2026? | ₹252,786,141.26 |
| How much income did we receive in July 2026? | ₹281,565,953.19 |
| How many transactions did we have in August 2026? | 2,384 |
| Which bank had the highest spend in August 2026? | HDFC, ₹61,708,570.02 |
| Which program had the highest spend in August 2026? | Program 21, ₹84,959,322.33 |
| Give me a financial summary for August 2026. | 2,384 transactions; ₹252,786,141.26 debit; ₹230,351,207.80 credit |
| What was our largest transaction? | ₹50,00,000.00 debit, August 14, 2026 |
| Find transaction TXN-DEMO-000001. | ₹4,607.95 debit, Jan 1 2025, "NEFT - SOFTWARE SUBSCRIPTION" |
| What is the balance of account ending 7622? | CNRB account, ₹23,185,815.48 |
| Did we spend more in August than July 2026? | Yes - ₹252,786,141.26 vs ₹202,228,913.02 |

If you regenerate the seed, re-verify these before relying on them -
they're a property of the deterministic generator's current output, not
a hardcoded guarantee.

## Explainability, copy, and export

Every successful answer can expand a **"How this answer was derived"**
section showing the exact validated intent, the deterministic query
plan, the registered SQL template, a safe rendering of that SQL with its
bound parameter values (explicitly labeled as a display-only
representation - the real query still executes parameterized), the raw
database result, and the deterministic transformation steps that
produced the final answer. Every user message and every answer has a
copy button; every answer has a JSON export (always) and a CSV export
(when the response is a bank/program ranking). See
`apps/api/README.md` ("Explainability") and `apps/web/README.md`
("How this answer was derived" / "Copy and export") for the implementation.

## Security

- `account_number` and `utr_number` (raw database columns) and
  `entity_id` (an internal identifier) are never included in any API
  response - not filtered out on the frontend, genuinely never selected
  or serialized by the backend in the first place. Account references are
  always `last4`, computed as `RIGHT(account_number, 4)` in SQL - the
  full column is never selected.
- The one place the literal identifier `account_number` legitimately
  appears in a response is inside the `account_balance` intent's SQL
  template/rendered-SQL text in the technical trace (`RIGHT(a.account_number, 4)`)
  - that's the column name in a query string, proving last4 is derived
    safely, not the sensitive value itself. This is covered by a
    regression test that builds the *real* SQL template and asserts the
    raw account number value never appears anywhere while that query
    text does. See `apps/api/src/response/responseFormatter.test.ts`.
- No secret (`DATABASE_URL`, `GEMINI_API_KEY`, or any credential) is ever
  part of a response payload; both live only in backend environment
  variables (`apps/api/.env`), never sent to the frontend.
- All SQL is parameterized (`$1`, `$2`, ...) via `pg` - there is no string
  concatenation of user input into a query anywhere in the codebase.

## Known limitations

- Ten intents only. Anything outside them (vendor names, transaction
  categories, reconciliation/settlement status, anything not modeled in
  the 3-table schema) is explicitly unsupported and answered as such,
  not guessed at.
- `transaction_lookup` matches by `transaction_reference_id` only - UTR
  lookup is not implemented.
- CSV export only appears for ranking-shaped responses
  (`transaction_spend_by_bank` / `transaction_spend_by_program`); every
  other intent's evidence is a single value or record, which the JSON
  export already covers.
- No frontend automated test suite (see `apps/web/README.md`); frontend
  correctness is covered by its type-check/build and by manual
  verification against the live API.

## Local setup

```bash
# 1. Backend
cd apps/api
npm install
cp .env.example .env   # fill in DATABASE_URL and GEMINI_API_KEY
psql "$DATABASE_URL" -f schema.sql
npm run seed
npm run dev             # http://localhost:3000

# 2. Frontend (separate terminal)
cd apps/web
npm install
npm run dev              # http://localhost:5173, proxies /api and /health to :3000
```

Full details, environment variables, and troubleshooting are in each
app's own README.

## Running tests / type-checks / builds

```bash
cd apps/api && npm test && npx tsc --noEmit && npm run build
cd apps/web  && npx tsc -b && npm run build   # no test suite in this package
```

## Hackathon talking points

**Why Gemini, and why this model specifically?**
Gemini is used for exactly one narrow job: recognizing which of the 10
approved intents a question maps to, and extracting its already-typed
fields (a bank code, a date range, a last-4 digit string, ...). It never
sees the database, never writes SQL, and never produces a financial
value. The configured model is `gemini-3.1-flash-lite`
(`apps/api/.env.example` / `apps/api/src/config/env.ts`, overridable via
`GEMINI_MODEL`) - a fast, cheap model is enough for a closed 10-way
classification-plus-field-extraction task; nothing about this
architecture depends on a larger model, because the model is never asked
to reason about numbers. The call is made with `temperature: 0`
(`apps/api/src/ai/gemini.ts`) for the most reproducible output the API
allows, and always against exactly one configured model - no silent
fallback to a different model on failure (see "What else was compared"
below).

**How was this verified?**
Two layers, both real, not simulated:
- Automated: 277/277 backend Vitest tests passing, `tsc --noEmit` clean
  on both packages, and both packages build successfully (`apps/api`'s
  `tsc -p tsconfig.build.json`, `apps/web`'s `tsc -b && vite build`).
  (`apps/api/tests/validator.test.ts` is written against Node's built-in
  `node:test` runner and is reported separately via
  `npm run test:validator` - a pre-existing, unrelated quirk, not a
  failure; see `apps/api/README.md`.)
- Manual, end-to-end, against a live Gemini + PostgreSQL backend: all 10
  golden queries (one per supported intent) matched the database exactly,
  and 4 multi-turn follow-up conversations behaved correctly, in the
  verification pass recorded in this repository's history
  (`test: verify finance assistant end to end`). This phase's
  explainability/export work was itself re-verified live the same way -
  real Gemini calls, real Postgres queries, the technical trace panel
  opened and checked field-by-field against the actual request, every
  copy button and both export formats exercised, and the exported files
  inspected byte-for-byte for sensitive values.

**How accurate is it?**
10/10 golden queries matched the database exactly and 4/4 multi-turn
cases passed, from the verification pass above. No percentage is claimed
beyond what was actually counted - there is no larger benchmark suite
behind this project, and none is implied.

**What else was compared?**
`apps/api/src/ai/gemini.ts` originally tried a chain of candidate models
on failure (`gemini-3.1-flash-lite`, then `gemini-2.5-flash`,
`gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash`); this was
deliberately removed (commit `8d11e7d`, "remove automatic model fallback
chain to ensure deterministic benchmarking") in favor of always calling
exactly one configured model, so a given request's behavior doesn't
silently depend on which model happened to answer it. Separately, early
phases used a `@neondatabase/serverless`-based client before this project
moved to a plain `pg.Pool` (`apps/api/src/db/client.ts`) - a
schema/deployment change, not a model comparison. No alternative
prompting strategy or retrieval approach was formally benchmarked against
this one; the architectural choices (registered SQL over generated SQL,
no RAG) are design decisions justified above, not the result of a
bake-off.

**Why not let Gemini generate the SQL directly?**
Generated SQL means the LLM's output can, in principle, select a column
it shouldn't, join a table it shouldn't, or simply be wrong in a way
that's hard to catch consistently. Registering exactly 10 hand-written,
parameterized templates and only ever letting the LLM pick one by name
means every query that can run is one a person already reviewed - the
LLM narrows down which of 10 known-safe questions is being asked, it
never gets to invent an 11th.

**Why not RAG?**
See "Why not RAG" above - the domain is three tables and aggregate
questions, which is exactly what SQL is for. A retrieval layer would add
complexity to solve a problem that doesn't exist here (there's no large
corpus of unstructured documents to search) and would introduce a new
failure mode (retrieving the wrong evidence) in place of one that
already isn't present.

## Development workflow

Backend and frontend are developed and run independently (`apps/api` and
`apps/web` each have their own `package.json`, dependencies, and
scripts). There is no shared build step or monorepo tool linking them -
the only contract between them is the `/api/chat` and `/health` HTTP
endpoints, mirrored by hand in `apps/web/src/types/chat.ts`, and Vite's
dev-time proxy configuration.
