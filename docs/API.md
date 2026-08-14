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
{ "message": "Human-readable, shown to the user verbatim.", "fields": { "username": "That username is taken." } }
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
request would send; each file list becomes repeated parts under its own name
**with a `[]` suffix** (`receipts[0][]`, `photo[]`) — PHP keeps only the last
of repeated bare names, so the suffix is what lets every file arrive. Parse
`payload` exactly as you would a JSON body. Logically `POST` for creates and
`PATCH` for updates; on the wire a multipart update travels as `POST` with a
`_method=PATCH` part (Laravel method spoofing), because PHP cannot parse a
multipart `PATCH` body at all.

**Stored images.** `photoUrl`, `receiptUrls`, `slipUrl` are URLs the backend
serves, same-origin under the API and authorised by the same session cookie.
Relative paths (`/api/files/…`) are fine; the frontend puts them straight into
`<img src>`.

**Timeouts.** The client aborts reads after 20 s and uploads after 120 s and
shows a retry. Long-running work should not hide behind a single request.

**Rate limits.** Every endpoint is metered: **120 requests per minute**, counted
per account once signed in and per IP before that — so a branch where three
managers share one router never has them competing for one allowance. Over the
line is `429` with the usual `{ message }`, which is written for the manager and
should be shown verbatim. Two doors are tighter, both guarding something that
costs more than a read: sign-in pauses for a minute after **five failed
attempts** on the same identifier+IP, and the recovery PIN stops answering for
fifteen minutes after **five wrong tries** by the same owner. Both count only
failures, and one success clears the slate. Responses carry `X-RateLimit-Limit`
and `X-RateLimit-Remaining` if the client ever wants to back off early.

## Identity

### `GET /session`
Who is signed in, decided from the cookie.
**200** `{ manager: Manager | null, owner: Owner | null }` — exactly one set
when signed in, both `null` when anonymous (see 401 semantics above).

### `POST /session`
Body `{ identifier: string, password: string, remember: boolean }`.
`identifier` is a **username**. Accounts have no email address at all — see
"No email anywhere" below.
**200** the new `Session` (and the `Set-Cookie`).
**401** wrong credentials — `message` for the banner, optional `fields` on
`identifier`/`password`.

### `DELETE /session`
Ends the session, clears the cookie. **204.** The frontend treats sign-out as
done even if this request is lost — expire abandoned sessions server-side.

### No email anywhere

Nobody signs in with an email, nothing is mailed to one, and `Manager` and
`Owner` have no `email` field. A forgotten password is fixed by the owner
(see "Recovery" below), so there is no endpoint an anonymous caller can use to
start one — which also means there is nothing here to enumerate accounts with.

The owner has nobody above them to reset *their* password. That way back is
`php artisan twz:set-password <username>` over SSH, deliberately outside the
API: reaching the server is already proof of who you are.

### `GET /accounts/{accountId}/sign-ins`
**200** `SignInEvent[]`, newest first, `current: true` on the session making
the request. A manager may only read their own; the owner may read anyone's.
`place` may be `""` — the backend does no IP geolocation, and the UI skips an
empty place rather than render a dangling separator.

### `PATCH /account`
Updates whoever is signed in.
JSON body `{ name, username, avatarKind, removePhoto?: true }`, **or**
multipart (`payload` + one `photo` part) when a new photo is attached — a new
photo always wins over `removePhoto`.
**200** the refreshed `Session`. **422** with `fields` on `name` / `username`
(username uniqueness is the backend's check).

`avatarKind` is `"girl" | "boy"`: which stock avatar the account shows while
no photo is uploaded. **Girl is the default** for every account that has never
chosen. `Manager` and `Owner` carry it back in the session payload; a backend
that omits it is read as `"girl"`.

### `PUT /account/password`
Body `{ current: string, next: string }`. Both roles change their own password
here; the current one is the proof of identity, so a device left signed in
cannot silently re-key the account.
**204.** Wrong current password → **422** with `fields.current`; a `next` under
8 characters → **422** with `fields.next`. Success rotates the remember token,
signing out every remembered device — the session making the change stays.

This is also what retires the owner's seeded password: the backend seeds the
owner from `OWNER_USERNAME`/`OWNER_PASSWORD` in its `.env` exactly once, and
after this endpoint has run, the database owns the credential — no reseed
brings the `.env` value back.

## Branches and accounts (owner only)

`GET /stores` is readable by both roles — the manager area needs branch names.
Everything else here is owner-only: enforce `403` for managers.

### `GET /stores`
**200** `Store[]`.

### `GET /managers`
**200** `Manager[]`.

### `POST /managers`
Body `{ name, username, storeId, password }`. With no email in the system the
owner sets both halves of the credential and hands them over in person; the
backend never invents either.
**200** the created `Manager`. **422** `fields.username` when taken,
`fields.password` when under 8 characters, `fields.storeId` when the branch
already has a manager.

### `PUT /managers/{managerId}/password`
Recovery. Body `{ pin: string, password: string }`. Sets a manager's password
without the old one — the whole point, since nobody has it.
**204** on success.
**422** `fields.pin` on a wrong PIN, `fields.password` when under 8 characters.
**429** once the PIN has been wrong five times; the message says how long the
wait is.
**404** when the account is gone. **422** with a bare `message` when the target
is the owner — that is the artisan command's job, not this endpoint's.

Two locks, because this hands over an account: being the owner is the first,
the PIN is the second, so an unattended laptop still signed in is not enough.
Setting a password also rotates `remember_token`, signing out every device that
was still holding one.

### `GET /settings/reset-pin`
**200** `{ isDefault: boolean, length: number, changedAt: string | null }`.
Never the PIN itself — only a hash is stored, so there is nothing to send.
`isDefault` is true while it is still the value the app shipped with, including
the case where somebody set it back to that; the settings page says so out loud,
because a documented default is not a secret.

### `PUT /settings/reset-pin`
Body `{ currentPin: string, newPin: string }`. **204.**
**422** `fields.currentPin` when the old PIN is wrong, `fields.newPin` when the
new one is not exactly 4 digits. **429** shares the counter above.

The frontend shows the new PIN exactly once after this succeeds and will not
let the step close until a copy has been saved as an image or a PDF. There is
no screen that can show it again.

### `PATCH /managers/{managerId}/branch`
Body `{ storeId }`. Assigns the branch; if another manager holds it, **swap
the two server-side** — one branch, one manager is the backend's invariant.
**200** the full updated `Manager[]`.

### `PATCH /managers/{managerId}/active`
Body `{ active: boolean }`. Disables or re-enables a branch account. Disabling
revokes every door at once: live sessions are dropped, remembered devices
forgotten, push mailboxes deleted, and sign-in answers **403** until the
account is re-enabled. The branch assignment stays — a disabled manager still
holds their branch until it is reassigned, so the seat is visibly theirs.
**200** the full updated `Manager[]`. **404** when the account is gone.

## Search

### `GET /search?q=…&storeIds=…`
One query over everything the caller may see, covering the last **90 days**:
audited days, expenses, deposits — and for the owner, the manager accounts and
branches too. `storeIds` follows the repeated-key array convention and is the
caller's request, never their authority: a manager may only ask for their own
branch.

Matching: the query splits into tokens and **every token must appear
somewhere** in a record — its dates spelled several ways ("july",
"2026-08-03", "8/3/2026"), its amounts as bare digits ("480"), its words
("meals", "discrepancy", a deposit reference). A recognised date ("july 3",
"7/3/2026") narrows by the record's own day instead of substring-matching;
accounts and branches carry no day of their own, so a dated query skips them.

**200** `{ days, expenses, deposits, managers, branches }`, each group
`{ items, total }`: `days.items` are `DayAudit[]`, `expenses.items`
`ExpenseItem[]`, `deposits.items` `Deposit[]`, `managers.items` `Manager[]`,
and `branches.items` `{ id, name, managerName: string | null }[]`. Each group
holds at most **6** items, newest first; `total` counts every match so the UI
can say what it is not showing. `managers` and `branches` are always empty for
a manager. **422** `fields.q` under 2 or over 80 characters, **403**
out-of-scope `storeIds`.

## Sales

Range-shaped, never per-day: the dashboard asks for 90 days in one call.
Against Loyverse's request budget this is the difference between a page load
and an outage — see LOYVERSE.md.

### `GET /sales/daily?storeIds=…&from=…&to=…`
**200** `DailySales[]` — one row per requested store per day that has sales;
a day with none simply has no row.

`profit` (gross minus what the goods on the receipts cost the shop, Loyverse
line-item costs, refunds netted) is THE figure — every chart, table, and
headline draws it. `gross` stays on the wire but is never displayed.

**The house rule:** `expected = profit - expenses`. The capital share of the
takings stays in the shop to restock; what goes to the bank is the profit
less the day's spend. Sales rows carry no expense join, so their `expected`
reads `profit` as-is — the authoritative per-day figure a deposit is matched
against always comes from `/audits`.

### `GET /sales/hourly?storeIds=…&day=…`
**200** `HourPoint[]` summed across the requested stores, branch-local hours,
partial while the day is open. Hours with no sales have no point. `amount` is
**gross profit** for the hour, matching every figure the charts draw — gross
remains the deposit number, on `/audits` and in `DailySales.gross`.

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

## Cash advances

Drawer money an employee drew against their pay. Not an expense — the shop
gets it back on payday — but on the day it is drawn the cash is gone all the
same, so the audit ledger subtracts it from that day's expected deposit
exactly like spend. Kept apart from expenses so spend totals stay what the
branch actually spent. Same closed-day rule as expenses: once a deposit
covers the day, its advances are final (**422**).

### `GET /advances?storeId=…&from=…&to=…`
**200** `AdvanceItem[]`, oldest first.

### `POST /advances`
Body: `{ storeId, day, employee, amount, note? }` — one advance, JSON, no
files. `employee` is a name, not an account; employees are not users of this
app. **200** the created `AdvanceItem`. **422** on a closed day.

### `PATCH /advances/{id}`
Body: any of `{ employee, amount, note }`. **200** the updated `AdvanceItem`.
**404** unknown id, **422** when the day is already deposited.

### `DELETE /advances/{id}`
**204.** Same already-deposited guard as update.

## Audit and deposits

### `GET /audits?storeIds=…&from=…&to=…`
**200** `DayAudit[]` — one per store per day. `status` progresses
`open` (today) → `pending` (audited, no deposit) → `matched` / `discrepancy`.
`deposited`, `online`, `reference`, and `slipUrl` come from the covering
deposit, null until one exists. Rows carry both `gross` and `profit`, plus
the day's `expenses` and `advances` totals; the pages display profit, and
`expected = profit - expenses - advances` (the house rule) is the amount the
covering deposit's cash **plus its declared online money** is matched
against.

**A deposit covering several days repeats on every covered row**, so each row
also carries the batch context that keeps that honest: `depositCovers` (every
day the covering deposit spans — the whole batch, never clipped to the
queried range) and `depositExpected` (the expected sum the deposit was judged
against, frozen at recording; null on deposits from before it was stored).
Any over/short figure a client shows must compare `deposited + online`
against `depositExpected` — comparing a six-day deposit to one day's
`expected` invents a wild over-deposit.

**The ledger has a start day** (a backend setting, `audit_start_day`): days
before it were settled in the world before this app existed. They carry no
audit row and appear in no backlog — but their sales still show in
`/sales/daily`, so the charts keep their history.

### `GET /deposits/pending?storeId=…`
**200** `DayAudit[]` — audited days with no deposit against them, **oldest
first**, starting at the ledger's start day.

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
  "online": 1500,
  "reference": "004512",
  "covers": ["2026-08-01", "2026-08-02"],
  "slipSha": "…hex…",
  "slipPhash": "…hex…",
  "discrepancyReason": "…"
}
```

Files: one `slip` part (required), repeated `discrepancyProof` parts
(optional).

- `covers` must be pending days of that store; recording closes them. It may
  span at most `batchWindowDays` days (the owner's reconciliation rule) —
  more is **422** with `fields.days`.
- `online` (optional, ≥ 0, default 0) is the manager's declaration of money
  for the covered days that came in by GCash or bank transfer — sales that
  never touched the drawer and so never reach a deposit slip. It is stored on
  the deposit and echoed back on every `Deposit`.
- `matched` is the backend's verdict: **`amount` plus `online`** equals the
  covered days' expected sum, compared in centavos — an online sale must not
  read as a shortfall, and declaring online money never waives the reason for
  cash that is genuinely missing.
- When they differ, `discrepancyReason` is **required** (**422** without it) —
  a mismatch can never be recorded silently. It is the one field a human must
  fill; do not accept blank or trivial strings.
- `slipSha` / `slipPhash` are advisory client-side fingerprints and may be
  absent. **Recompute the SHA-256 server-side** and enforce one-photo-one-
  deposit on your own hash: a duplicate is **409** with `fields.slip`. The
  client's values are hints for early UX, never authority.
- An **over**-deposit (cash + online above the judged expected) records the
  same way a shortfall does — `discrepancyReason` required, `matched: false`,
  day status `discrepancy` — but clients paint it green as **"Over"**: the
  direction is derived from `deposited + online` against `depositExpected`
  (falling back to the single day's `expected`), never from a new status
  value on the wire.
- The expected sum the deposit was judged against is **stored on the deposit**
  (`Deposit.expected`) and echoed back, so the verdict can never drift from
  the figures it was made on.

**200** the created `Deposit`.

## Push reminders

Web push, signed with the app's VAPID pair (`VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` in the backend `.env`). The backend
plans and sends on its scheduler — hourly, on each **branch's own clock**:
an evening nudge when the till took money but no expense is logged, and a
morning nudge when two or more audited days await a deposit (worded harder
at and past the owner's batching window). Each reminder fires **once per
day** per branch, to the **branch manager's** subscribed browsers; a mailbox
the push service reports gone (404/410) is deleted on the spot.

### `GET /push/key`
**200** `{ key }` — the VAPID public key the browser subscribes with.

### `POST /push/subscriptions`
Body: the browser's `PushSubscription` — `{ endpoint, keys: { p256dh, auth } }`.
**204.** Upserted by endpoint: the same browser re-subscribing under another
account moves the mailbox — one endpoint never serves two accounts.

### `DELETE /push/subscriptions`
Body `{ endpoint }`. **204.** Only the mailbox's current holder may delete it.

## Settings (owner only)

### `GET /settings/pos`
**200** `{ connected: boolean, storesLinked: number, tokenHint: string }` —
`tokenHint` is the last few characters only; the token itself never leaves the
backend (see LOYVERSE.md).

### `POST /settings/pos/reconnect`
Re-validates the stored token against Loyverse. **204.**

### `GET /settings/reconciliation`
**200** `{ batchWindowDays: number }`. The one exception to owner-only in
this section: both roles may READ it — the manager's status card counts the
deposit backlog against this window. `PATCH` stays owner-only.

### `PATCH /settings/reconciliation`
Body `{ batchWindowDays: number }`, an integer 1–14. **204.** This drives the
backlog warnings on the manager's Deposits page and dashboard, and it is
**enforced on recording**: `POST /deposits` refuses (**422**, `fields.days`)
a deposit whose `covers` spans more days than the window — a rule the owner
dials, not a suggestion.

### `GET /settings/sales-filter`
**200** `FilteredItem[]` (`{ sku, name }`) — the items that never count
toward gross and profit: services and labor, whose money is not the drawer's
to deposit. The sync nets matching lines out of every receipt at ingest.

### `PUT /settings/sales-filter`
Body `{ items: FilteredItem[] }`, a whole-list replace (deduped by `sku`).
**200** the saved list. When the SKU set actually changes, the backend
**clears the stored receipts and the sync watermark** — the aggregates the
old filter shaped cannot be recomputed, only re-pulled — and the scheduler's
next tick rebuilds the backfill window. Same SKUs saved again touch nothing.

### `GET /catalog/search?q=…`
**200** up to 30 `FilteredItem` matches from the POS item catalog, matched
against name and SKU (`q` is 2–80 chars, **422** below that). The backend
walks the catalog once and caches it for `catalog_ttl`; the client never
downloads the whole catalog. **503** with a human message when the POS
cannot be reached.

## Not in this contract, on purpose

- **Search** — currently a client-side index over data already on the page.
  A real dataset needs a backend query endpoint; design it fresh rather than
  freezing the browser index's shape. See the note at the bottom of
  `contracts.ts`.
- **Anything Loyverse** — store mapping, token storage, rate budgeting,
  webhooks. The frontend knows only its own domain types; `LOYVERSE.md` is
  the integration study.
