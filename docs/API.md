# TWZ Manager — backend API spec

What the frontend expects of a backend, endpoint by endpoint. The compile-time
half of this contract is [`src/lib/api/contracts.ts`](../src/lib/api/contracts.ts)
(method signatures) and [`src/lib/api/types.ts`](../src/lib/api/types.ts) (wire
shapes); the request plumbing that encodes everything below is
[`src/lib/api/client.ts`](../src/lib/api/client.ts) and
[`src/lib/api/http.ts`](../src/lib/api/http.ts). If this file and those files
ever disagree, fix the drift before building on either.

What the backend owes Loyverse upstream — token handling, rate budget, webhook
strategy — is [`LOYVERSE.md`](./LOYVERSE.md).

## Conventions

**Base URL.** Every path below hangs off `VITE_API_URL`, default `/api`
(same-origin). Same-origin is the recommended deployment: the session cookie
then needs no cross-site story at all.

**Authentication.** A session cookie, set by `POST /session` — `httpOnly`,
`Secure`, `SameSite=Lax`. The frontend sends `credentials: "include"` on every
request and never sees or stores a token. `remember: true` at sign-in asks for
a long-lived cookie; `false` means a browser-session cookie.

**Who may see what.** A manager account is scoped to one branch. The backend
must enforce that scope on every read and write — reject a manager asking for
another branch's `storeId` with `403`. The `storeIds` query argument is the
caller's request, never their authority.

**Errors.** Non-2xx responses carry:

```json
{ "message": "Human-readable, shown to the user verbatim.", "fields": { "email": "That Gmail already has an account." } }
```

- `message` is required and user-facing — write it for the branch manager, not
  the developer.
- `fields` is optional, keyed by the request field the problem is on; the form
  shows each message beside its field.
- Status codes the frontend reacts to: `401` (drops to the sign-in screen —
  see below), `409` (duplicate slip), `422` (validation, usually with
  `fields`). Anything ≥500 shows a generic retry message.

**401 semantics.** Any `401` from any endpoint makes the app drop its session
state and walk the user to `/login`. Because of that, `GET /session` must
answer an anonymous visitor with **`200 {"manager": null, "owner": null}`**,
not `401` — anonymous is an answer, not an error. (The client tolerates a 401
there, but returning one costs a wasted signed-out transition on every boot.)

**Days and instants.** An audit day is a branch-local calendar day and crosses
the wire as `"YYYY-MM-DD"` — never as an ISO instant, which would shift a
Manila evening onto the wrong day. Timestamps (`ExpenseItem.at`,
`SignInEvent.at`) are full ISO 8601 instants in UTC. Range parameters
(`from`, `to`) are inclusive day keys.

**Money.** Decimal pesos with at most two fraction digits (`1250.5`,
`46000`). The client rounds every amount it sends to the centavo and compares
amounts in integer centavos; the backend must do the same and never introduce
binary-float drift (store centavos as integers, or use a decimal type).

**Query arrays.** Repeated keys: `?storeIds=arevalo&storeIds=molo`. An empty
list is never legitimately sent — scoped queries always name at least one
store.

**Multipart uploads.** One convention everywhere: the non-file fields travel
as a single part named `payload` containing the same JSON object a bodied
request would send; each file list becomes repeated parts under its own name.
Parse `payload` exactly as you would a JSON body. `POST` for creates, `PATCH`
for updates — the method never changes just because files are attached.

**Stored images.** `photoUrl`, `receiptUrls`, `slipUrl` are URLs the backend
serves, same-origin under the API and authorised by the same session cookie.
Relative paths (`/api/files/…`) are fine; the frontend puts them straight into
`<img src>`.

**Timeouts.** The client aborts reads after 20 s and uploads after 120 s and
shows a retry. Long-running work should not hide behind a single request.

## Identity

### `GET /session`
Who is signed in, decided from the cookie.
**200** `{ manager: Manager | null, owner: Owner | null }` — exactly one set
when signed in, both `null` when anonymous (see 401 semantics above).

### `POST /session`
Body `{ identifier: string, password: string, remember: boolean }`.
`identifier` is a username or Gmail address.
**200** the new `Session` (and the `Set-Cookie`).
**401** wrong credentials — `message` for the banner, optional `fields` on
`identifier`/`password`.

### `DELETE /session`
Ends the session, clears the cookie. **204.** The frontend treats sign-out as
done even if this request is lost — expire abandoned sessions server-side.

### `POST /password-resets`
Body `{ identifier: string }`. Sends a reset link if the account exists.
**204 either way** — the response must not reveal whether an account exists.

### `GET /accounts/{accountId}/sign-ins`
**200** `SignInEvent[]`, newest first, `current: true` on the session making
the request. A manager may only read their own; the owner may read anyone's.

### `PATCH /account`
Updates whoever is signed in.
JSON body `{ name, username, email, removePhoto?: true }`, **or** multipart
(`payload` + one `photo` part) when a new photo is attached — a new photo
always wins over `removePhoto`.
**200** the refreshed `Session`. **422** with `fields` on `name` / `username`
/ `email` (uniqueness of username/email is the backend's check).

### `PUT /account/password`
Body `{ current: string, next: string }`.
**204.** Wrong current password → **422** with `fields.current`.

## Branches and accounts (owner only)

`GET /stores` is readable by both roles — the manager area needs branch names.
Everything else here is owner-only: enforce `403` for managers.

### `GET /stores`
**200** `Store[]`.

### `GET /managers`
**200** `Manager[]`.

### `POST /managers`
Body `{ name, email, storeId }`. Issues an account (the backend generates the
username and the initial credential flow).
**200** the created `Manager`. **422** `fields.email` when taken,
`fields.storeId` when the branch already has a manager.

### `PATCH /managers/{managerId}/branch`
Body `{ storeId }`. Assigns the branch; if another manager holds it, **swap
the two server-side** — one branch, one manager is the backend's invariant.
**200** the full updated `Manager[]`.

## Sales

Range-shaped, never per-day: the dashboard asks for 90 days in one call.
Against Loyverse's request budget this is the difference between a page load
and an outage — see LOYVERSE.md.

### `GET /sales/daily?storeIds=…&from=…&to=…`
**200** `DailySales[]` — one row per requested store per day in range.
`expected = gross - expenses` (the day's logged expenses).

### `GET /sales/hourly?storeIds=…&day=…`
**200** `HourPoint[]` summed across the requested stores, branch-local hours,
partial while the day is open.

## Expenses

### `GET /expenses?storeId=…&from=…&to=…`
**200** `ExpenseItem[]`. `at` is the logging instant; `receiptUrls` the stored
photos.

### `POST /expenses` (multipart)
`payload`: `{ items: [{ storeId, day, category, note, amount }, …] }`.
Files: parts named `receipts[0]`, `receipts[1]`, … — the index binds each
photo list to the item at that position in `items`.
**200** the created `ExpenseItem[]` in the same order.
**422** when an amount is not positive, a category does not exist, or a day is
already covered by a deposit (the frontend prevents this, the backend enforces
it).

### `PATCH /expenses/{id}`
JSON body `{ category?, note?, amount? }` when the photos did not change.
Multipart when they did: `payload` gains `keepReceipts: string[]` — the stored
URLs that survive the edit — and new photos arrive as repeated `receipts`
parts. **Anything stored but absent from `keepReceipts` is deleted.**
**200** the complete updated `ExpenseItem`. **404** unknown id, **409/422**
when the day is already deposited.

### `DELETE /expenses/{id}`
**204.** Same already-deposited guard as update.

### `GET /expense-categories`
**200** `ExpenseCategoryConfig[]`. Readable by both roles — the manager's
picker is built from it.

### `PUT /expense-categories` (owner only)
Body: the full `ExpenseCategoryConfig[]` (this is a whole-list replace; ids
are stable across renames). **200** the saved list. **422** on blank or
duplicate names. Existing expenses keep their old category string when one is
renamed or removed — the frontend renders unknown categories with a fallback
icon, deliberately.

## Audit and deposits

### `GET /audits?storeIds=…&from=…&to=…`
**200** `DayAudit[]` — one per store per day. `status` progresses
`open` (today) → `pending` (audited, no deposit) → `matched` / `discrepancy`.
`deposited`, `reference`, and `slipUrl` come from the covering deposit, null
until one exists.

### `GET /deposits/pending?storeId=…`
**200** `DayAudit[]` — audited days with no deposit against them, **oldest
first**, however far back they run.

### `GET /deposits?storeId=…&from=…&to=…`
**200** `Deposit[]` filed in the range (`day` is the deposit date, not the
covered days), newest first.

### `POST /deposits` (multipart)
`payload`:

```json
{
  "storeId": "arevalo",
  "day": "2026-08-04",
  "amount": 43110.5,
  "reference": "004512",
  "covers": ["2026-08-01", "2026-08-02"],
  "slipSha": "…hex…",
  "slipPhash": "…hex…",
  "discrepancyReason": "…"
}
```

Files: one `slip` part (required), repeated `discrepancyProof` parts
(optional).

- `covers` must be pending days of that store; recording closes them.
- `matched` is the backend's verdict: amount equals the covered days'
  expected sum, compared in centavos.
- When they differ, `discrepancyReason` is **required** (**422** without it) —
  a mismatch can never be recorded silently. It is the one field a human must
  fill; do not accept blank or trivial strings.
- `slipSha` / `slipPhash` are advisory client-side fingerprints and may be
  absent. **Recompute the SHA-256 server-side** and enforce one-photo-one-
  deposit on your own hash: a duplicate is **409** with `fields.slip`. The
  client's values are hints for early UX, never authority.

**200** the created `Deposit`.

## Settings (owner only)

### `GET /settings/pos`
**200** `{ connected: boolean, storesLinked: number, tokenHint: string }` —
`tokenHint` is the last few characters only; the token itself never leaves the
backend (see LOYVERSE.md).

### `POST /settings/pos/reconnect`
Re-validates the stored token against Loyverse. **204.**

### `GET /settings/reconciliation`
**200** `{ batchWindowDays: number }`.

### `PATCH /settings/reconciliation`
Body `{ batchWindowDays: number }`, an integer 1–14. **204.** This drives the
backlog warnings on the manager's Deposits page and dashboard.

## Not in this contract, on purpose

- **Search** — currently a client-side index over data already on the page.
  A real dataset needs a backend query endpoint; design it fresh rather than
  freezing the browser index's shape. See the note at the bottom of
  `contracts.ts`.
- **Anything Loyverse** — store mapping, token storage, rate budgeting,
  webhooks. The frontend knows only its own domain types; `LOYVERSE.md` is
  the integration study.
