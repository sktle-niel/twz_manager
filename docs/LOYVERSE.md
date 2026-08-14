# Loyverse POS integration

What the backend has to do, and why the browser can play no part in it.

Sources: [API reference](https://developer.loyverse.com/docs/) ·
[Postman collection](https://developer.loyverse.com/docs/Loyverse_API.postman_collection.json) ·
[Creating tokens](https://help.loyverse.com/help/loyverse-api) ·
[API FAQ](https://support.loyverse.com/en/articles/8061203-faqs-about-loyverse-api) ·
[API terms](https://loyverse.com/api-terms)

## The one constraint that decides the architecture

> "The token gives unlimited access to all resources provided by the Loyverse API."
> — [Loyverse, on creating access tokens](https://help.loyverse.com/help/loyverse-api)

There are **no scopes**. A Loyverse token cannot be narrowed to "read receipts for one
store". Whoever holds it can read every customer, edit every item, change inventory, and
issue refunds across the whole merchant account.

So the token can never reach the browser. Not in a `VITE_` variable — those are compiled
into the bundle and readable by anyone who opens devtools. Not in `localStorage`. Not
proxied through a URL the browser can call unauthenticated.

**TWZ Manager talks only to our own backend. Only the backend holds the Loyverse token.**
That is why `src/lib/api/` has no concept of Loyverse in it at all: the frontend asks for
"daily sales for these branches between these dates" and does not care where they came
from.

A second reason lands in the same place: the rate limit below is *per account*, not per
user. Four managers refreshing dashboards cannot each be spending the merchant's shared
request budget.

## The API

| | |
|---|---|
| Base URL | `https://api.loyverse.com/v1.0` |
| Auth | `Authorization: Bearer <token>` — personal access token, or OAuth 2.0 for a published app |
| Pagination | `limit` (default 50, **max 250**) + opaque `cursor`; responses carry the next `cursor` |
| Rate limit | **300 requests per 300 seconds, per account** — an average of one per second |
| Tokens | Max 20 per account; deleting one cuts access immediately; expiry is optional |

Endpoints available: `categories`, `customers`, `discounts`, `employees`, `inventory`,
`items`, `merchant`, `modifiers`, `payment_types`, `pos_devices`, `receipts`, `stores`,
`suppliers`, `taxes`, `variants`, `webhooks`.

Of those, this app needs **`stores`** and **`receipts`**. Nothing else.

### Rate limit maths

The limit is what forces a sync rather than a passthrough. One request per second, shared
across the whole merchant, against four branches that each want a running daily total and
a 90-day history. A dashboard that called Loyverse on page load would exhaust the budget
with a handful of managers and start failing for everyone, including the POS integrations
that are not ours.

**The backend syncs on a schedule and serves our own database.** Loyverse is upstream, not
a live dependency of a page render.

## The sync

### Incremental, by `updated_at`

`GET /receipts` accepts `created_at_min` / `created_at_max` and `updated_at_min` /
`updated_at_max`. Poll on **`updated_at_min`**, not `created_at_min`: a receipt that is
later cancelled or refunded has its `updated_at` bumped, and a create-time query would
never see the change. A day's sales total that silently ignores a same-day refund is a
reconciliation that will not balance, which is the failure this whole app exists to catch.

Store the high-water mark from each run and pass it as the next `updated_at_min`, with a
small overlap (a minute or two) to absorb clock skew.

### What to keep

Per receipt: `receipt_number`, `receipt_type` (`SALE` / `REFUND`), `refund_for`,
`store_id`, `receipt_date`, `created_at`, `updated_at`, `cancelled_at`, `total_money`,
`total_discount`, `total_tax`, `payments`, `line_items`.

Rules that matter for the daily total:

- **Skip cancelled receipts** — a non-null `cancelled_at` means it never counted.
- **Subtract refunds.** A `REFUND` receipt is a separate record pointing at the original
  through `refund_for`. Gross sales for a day is sales minus refunds *dated that day*,
  which is not always the day of the original sale.
- **Only paid receipts are exposed.** Per the Loyverse FAQ, the API returns paid receipts
  only, so open tabs and unpaid orders never appear. That suits us — the audit is of money
  taken.
- **`receipt_date` is the business timestamp**, `created_at` is when the record appeared.
  Bucket days by `receipt_date` in the **store's own timezone**, not UTC. A sale at 11pm in
  Iloilo is 3pm UTC the same day, but the day boundary must be the branch's, or every
  late-evening sale lands on the wrong audit day.
- **Services and labor are not sales.** The shop's SERVICES & LABOR items (labor charges,
  diagnostics, cleaning packages — the excluded-SKU list lives in the backend's
  `sales_excluded_skus` setting, seeded with the owner's 24-item price-list grouping) are
  netted out of each receipt's gross and cost at ingest, by matching each line's `sku`.
  That money never sits in the drawer as parts takings, so counting it would raise every
  expected-deposit figure the reconciliation checks. The receipts table stores aggregates,
  so changing the list needs a re-pull (clear the watermark and receipts) to recompute
  the past.

### Mapping branches

`GET /stores` returns Loyverse's store list. Our `Store.id` (`arevalo`, `molo`, …) is ours,
not theirs — keep a `loyverse_store_id` column against each branch rather than adopting
their ids, so a branch can be renamed or re-linked without rewriting history.

### Webhooks

Loyverse supports webhooks (`receipts.update` among them). Worth adding **after** the
polling sync works, as a latency improvement rather than the source of truth: webhooks can
be missed, and a scheduled reconcile is the thing that makes the ledger eventually correct
regardless.

## What the backend owes the frontend

`src/lib/api/contracts.ts` is the exact list, and it is deliberately **range-shaped**, not
per-day: the UI asks for 90 days in one call, never 90 calls. The sample adapter in
`src/lib/api/sample.ts` implements the same interface, so the contract is executable today
and the HTTP adapter is the only thing that changes.

Loyverse only covers the sales half. Everything else — expenses, deposits, discrepancy
forms, receipt images, accounts, sign-in history — is ours to store, and none of it exists
in Loyverse.

| Concern | Source |
|---|---|
| Daily and hourly gross sales | Loyverse receipts, synced |
| Branch list | Ours, linked to a Loyverse store id |
| Expenses and their receipt photos | Ours |
| Deposits, slips, discrepancy forms | Ours |
| Manager accounts, sign-in history | Ours |
| Expense categories and the receipt rule | Ours |

## Before going live

- [x] Token in the backend's secret store, never in the repo and never in a `VITE_` variable —
      it lives only in the server `.env` (`LOYVERSE_API_TOKEN`), read by `config/loyverse.php`
- [ ] Read the [API terms](https://loyverse.com/api-terms) — they bind the merchant account
- [x] Sync job with a persisted `updated_at` high-water mark and overlap —
      `ReceiptSync`: watermark in settings, 2-minute overlap, advances only on a completed walk
- [x] Per-store timezone on the branch record, used for day bucketing —
      `stores.timezone`, applied at ingest and in the audit ledger's per-branch "today"
- [x] Backoff and alerting on 429 — the client refuses locally at 240/300s before sending,
      honors an upstream `Retry-After` as an app-wide cooldown, and logs both loudly
- [x] Nightly full reconcile of the trailing 7 days — `twz:sync-sales --days=7`, scheduled
      03:30 daily; upserts wholesale and never moves the watermark
