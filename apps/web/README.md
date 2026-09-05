# TBX Finance Assistant - Web

The chat frontend for TBX Finance Assistant: a React + TypeScript SPA
(Vite) that lets someone ask natural-language finance questions about
Northstar Technologies Pvt. Ltd. and renders the backend's grounded
answer, its evidence, and (for hackathon transparency) exactly how that
answer was derived.

See the [root README](../../README.md) for the full product/architecture
overview. This file covers only the frontend.

## Stack

- React 19 + TypeScript, built with Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- `radix-ui` primitives (collapsible, dropdown menu, tooltip, avatar, ...)
- `motion` for the small entrance/transition animations
- `lucide-react` for icons
- `oxlint` for linting (no test suite - see below)

## Structure

```
src/
  App.tsx                    Top-level layout: header + ChatShell
  components/
    layout/AppHeader.tsx      Header, connection status
    theme/ThemeToggle.tsx     Light/dark toggle
    decor/GradientOrbs.tsx    Background decoration
    chat/
      ChatShell.tsx            Message list, composer, orchestration
      Composer.tsx             The message input
      EmptyState.tsx           Sample questions shown before the first message
      SuggestionChips.tsx      Follow-up sample questions after a reply
      UserMessage.tsx          A user's message bubble (with copy button)
      AnswerCard.tsx           An assistant's successful answer, evidence,
                               technical trace, copy, and export
      EvidencePanel.tsx        Renders the structured `evidence` for a reply
      TechnicalTracePanel.tsx  Renders the "how this answer was derived" trace
      CopyButton.tsx           Shared Clipboard-API copy button
      LoadingMessage.tsx / ErrorMessage.tsx / InfoMessage.tsx
                               Non-success reply states
    ui/                       Small shared primitives (button, card,
                               collapsible, dropdown-menu, tooltip, ...)
  hooks/
    useApiHealth.ts           Polls GET /health for the header's status dot
    useTheme.ts               Light/dark theme state + persistence
  lib/
    api.ts                    sendChatMessage() - the only fetch to /api/chat
    export.ts                 JSON/CSV export of a response, client-side only
    format.ts                 Currency/period/string display formatting
    suggestions.ts            The 10 canonical sample questions
    utils.ts                  `cn` re-export
  types/chat.ts               Frontend mirror of the API's response shapes
```

## Chat flow and the API contract

`lib/api.ts`'s `sendChatMessage()` is the only place that calls the
backend (`POST /api/chat`). It normalizes whatever JSON comes back into a
`ChatApiResult` (`types/chat.ts`) and never reshapes or recomputes a
value - the UI renders exactly what the API sent.

- `answer` / `summary` / `evidence` render the actual reply
  (`AnswerCard.tsx` + `EvidencePanel.tsx`)
- `technical`, present only on successful responses, is the explainability
  trace (see below) and is passed through untouched as well
- Non-success statuses (`clarification`, `not_found`,
  `unsupported_ai_intent`, `unsupported_query_intent`,
  `execution_error`, `parser_error`) render as an `InfoMessage` or
  `ErrorMessage` rather than crashing

In development, Vite proxies `/api` and `/health` to the backend on
`http://localhost:3000` (see `vite.config.ts`) - no `VITE_API_BASE_URL`
needed locally. In a deployment where the frontend and backend aren't
served from the same origin, set `VITE_API_BASE_URL` to the backend's
base URL and `sendChatMessage` will call `${VITE_API_BASE_URL}/api/chat`
instead.

## Sample questions

`lib/suggestions.ts` holds the 10 canonical sample questions - one per
supported intent - shown in `EmptyState` before the first message and as
follow-up chips in `SuggestionChips` after a reply. Every question uses
real, verifiable scope from the seeded dataset (August/July 2026,
`TXN-DEMO-000001`, a real seeded account) - never an unsupported
vendor/category/reconciliation concept.

## "How this answer was derived"

When a response includes a `technical` field, `AnswerCard` shows a
collapsed-by-default "How this answer was derived" section
(`TechnicalTracePanel.tsx`) alongside the existing "View evidence"
section. It renders, in order: the user's question, the recognized
intent name and description, the validated intent JSON, the query plan,
the registered SQL template, a safe rendering of that SQL with its bound
parameter values substituted in (explicitly labeled as **not** the
execution mechanism), the raw database result, a note that the response
formatter's input is exactly the query plan and database result already
shown, the deterministic transformation steps, and a closing note that
the final answer/summary/evidence above is the output of those steps.
Every value comes directly from the `technical` object the API sent -
nothing here is reconstructed or recalculated on the frontend. Each JSON
block has its own copy button, plus one button to copy the entire trace.

## Copy and export

- Every user message and every assistant answer has a copy button
  (`CopyButton.tsx`) using the Clipboard API, with a legacy
  `document.execCommand("copy")` fallback and a visible "copied"/"failed"
  state - it never throws on failure.
- Every successful answer has an export menu (the download icon next to
  the answer): **Export as JSON** always serializes the exact
  `ChatApiResult` already rendered (including the technical trace, when
  present) to a `tbx-finance-response-<timestamp>.json` file via a
  client-side Blob download - never DOM-scraped, never uploaded anywhere.
  **Export as CSV** additionally appears when the response carries
  tabular ranking evidence (`transaction_spend_by_bank` /
  `transaction_spend_by_program`) and exports those rows as
  `tbx-finance-response-<timestamp>.csv`.
- Nothing exported can contain more than what the backend already sent -
  the API itself never includes `account_number`, `utr_number`, or
  `entity_id` in the first place (see the root README's security
  section), so there's no separate frontend sanitization step to get
  wrong.

## Theming, responsiveness, and states

- Light/dark mode via `useTheme.ts` + `ThemeToggle.tsx`, using Tailwind's
  `dark:` variant.
- The layout is a single responsive column; the technical trace and
  evidence panels wrap and scroll horizontally where needed (long SQL/JSON)
  rather than overflowing the page.
- `LoadingMessage` shows while a request is in flight; `ErrorMessage`
  covers network/parse failures; `InfoMessage` covers backend statuses
  like `clarification`, `not_found`, and `unsupported_ai_intent` /
  `unsupported_query_intent` - an unsupported question never crashes the
  UI, it renders as a normal assistant message explaining what's supported.

## Local setup

```bash
npm install
npm run dev
```

Requires the API running separately (see `../api/README.md`) for the dev
proxy to have something to talk to - `npm run dev` here alone will start
the UI but chat requests will fail until the API is up.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server (proxies `/api` and `/health` to `http://localhost:3000`) |
| `npm run build` | `tsc -b && vite build` - type-checks then builds `dist/` |
| `npm run lint` | Runs `oxlint` |
| `npm run preview` | Serves the built `dist/` locally |

There is no frontend test suite in this package (no `test` script) -
correctness here is covered by `npm run build`'s type-check and by manual
verification against the running API described in the root README.

## Environment variables

- `VITE_API_BASE_URL` (optional) - base URL for the API when it isn't
  served from the same origin as the frontend (see "Chat flow" above).
  Not needed for local development.

## Troubleshooting

- **Chat requests fail / network error in the UI** - confirm the API is
  running on port 3000 (`cd ../api && npm run dev`) and that
  `GET http://localhost:3000/health` returns `{"status":"ok"}`.
- **`npm run build` fails on a type error in `types/chat.ts`** - check
  that it still matches `apps/api/src/response/responseFormatter.ts`'s
  `FormattedFinanceResponse`/`TechnicalTrace` shapes; the two are kept in
  sync by hand, not shared via a package.
- **A new answer never shows "How this answer was derived"** - that
  section only renders when the API response includes a `technical`
  field, which only successful (`status: "success"`) responses carry.
