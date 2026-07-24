# TWZ Manager — Project Context

## What this is

TWZ Manager is an internal web app (PWA) for **Two Wheels Zone**, a multi-branch motorcycle shop business. It digitizes the daily sales audit and bank deposit reconciliation process that is currently done by hand. The primary users are **branch managers**; the **business owner** uses it for oversight and assurance.

It ships as a PWA used on phones and laptops because the team cannot build a native mobile app yet.

## The problem

Today the process is traditional and handwritten:

1. Every night, each branch audits the day: they list everything sold and all expenses on paper.
2. They deposit the day's earnings to the bank.
3. They take a photo of the deposit receipt and send it to the owner.

This is slow, error-prone, and gives the owner no reliable way to verify that the amount deposited actually matches what the branch earned that day. The owner's core need is **assurance that deposits are accurate**.

## What already exists

All sales in every branch go through **Loyverse POS**. Every sale is already recorded there, so the system does not need manual sales entry — it needs to pull sales data from Loyverse and reconcile it against bank deposits.

## What we are building

An automated daily sales audit and deposit reconciliation system, per branch (store):

1. **Sales tracking** — Pull each branch's sales for the day from Loyverse POS, so sales can be monitored throughout the day.
2. **Expense logging** — Branches record daily expenses (food and any other expense). The company covers meals and snacks (merienda) for staff, so these are legitimate expenses that are **automatically deducted** from the amount expected to be deposited. Every expense entry requires a **receipt attachment**.
3. **Expected deposit computation** — For each branch, per day:

   ```
   Expected deposit = Loyverse POS daily sales − approved expenses (meals, snacks, other logged expenses)
   ```

4. **Deposit recording** — The branch manager deposits earnings to the bank and records the deposit in the app (amount + deposit slip/receipt photo). This replaces sending receipt photos to the owner manually.
   - **Deposits are not always daily.** Sometimes a branch deposits every day; sometimes it batches and deposits every ~3 days. A single bank deposit can therefore cover **one or several audited days**.
   - When recording a deposit, the manager selects which day(s) it covers (typically all unreconciled days since the last deposit).
5. **Reconciliation (the core rule)** — The recorded bank deposit **must match** the total expected deposit for the day(s) it covers:

   ```
   Expected deposit (at deposit time) = sum over covered days of (POS daily sales − approved expenses)
   ```

   - **If it matches:** the covered days are closed as reconciled.
   - **If it does not match:** the app **automatically requires a discrepancy form** before the covered days can be closed. The form must have:
     - A **reason field** (with placeholder text guiding the manager on what to explain)
     - A **receipt attachment** field (e.g., meal receipts) to justify the difference
6. **Owner visibility** — The owner can see, per branch and per day: sales, expenses, expected deposit, actual deposit, match status, and any discrepancy forms with their attachments.

## Daily flow (target state)

| Step | Who | What happens |
|---|---|---|
| Throughout the day | System | Sales flow into Loyverse POS; app tracks the running daily total per branch |
| During the day | Branch manager | Logs expenses (meals, snacks, others) with receipt photos; these auto-deduct from the expected deposit |
| Evening (every day) | Branch manager | Reviews and closes the day: POS sales total and logged expenses; app records the day's net income and adds it to the running amount due for deposit |
| Deposit day (daily, or batched up to every ~3 days) | Branch manager | Deposits the accumulated cash at the bank, then records the deposit amount, selects the day(s) it covers, and attaches the deposit slip photo |
| Deposit day | System | Compares deposit vs the total expected for the covered day(s). Match → those days reconciled. Mismatch → discrepancy form (reason + receipt attachment) is required |
| Anytime | Owner | Reviews dashboards/reports per branch: sales, expenses, amounts due for deposit, deposits, match status, discrepancies |

## Key rules

- The **audit is per branch (store), per day** — every day is closed with its POS sales and expenses, even when no deposit happens that day.
- **Deposits can be daily or batched** (commonly up to every 3 days). One deposit covers one or more audited days, and reconciliation runs against the **sum** of those days.
- Days that have been audited but not yet covered by a deposit show as **pending deposit** (amount due accumulates until the next deposit).
- A mismatch can never be silently closed — the discrepancy form (reason + attachment) is mandatory.
- Meals and merienda are company-covered: logged as expenses with receipts and deducted automatically from the expected deposit.
- Receipts/attachments are required evidence for expenses, deposits, and discrepancies.

## Technical notes

- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS v4. Icons: `@phosphor-icons/react`.
- **Platform:** PWA (installable on phones; works on laptops).
- **POS integration:** Loyverse POS is the source of truth for sales. Integration will use the Loyverse API (stores, receipts) — exact endpoints/auth to be confirmed during backend work.
- **Auth:** Sign in with username or Gmail + password. Branch managers get accounts issued by the owner. (Auth backend not built yet — the login form currently validates client-side only.)
- **Repo:** https://github.com/sktle-niel/twz_manager (branches: `main`, `development`).

## Current status (2026-07-24)

- Login page UI is built (light, minimal, formal design; brand green as accent).
- Dashboard UI is built with mock data: gross sales area chart (hourly points for a single day, one point per day for ranges), a branch filter and a Loyverse-style date-range picker, and a per-day summary list (gross sales, expenses, expected deposit).
- App shell: sidebar navigation on desktop (Dashboard, Expenses, Deposits, History, Account); iOS-style bottom tab bar on mobile (Dashboard, Expenses, center "New entry" button opening a sheet, Deposits, History) with Account in the top-right of the mobile header.
- Expenses page UI: log form (amount, category, note, required receipt photo) plus recent-expenses list. Categories: Meals, Merienda, Water bill, Electric bill, Wifi bill, Other — each with its own icon, note placeholder, and default note (only "Other" forces a note). In the mock, the three utility bills are monthly rather than daily: electric on the 5th, water on the 10th, wifi on the 15th of each month, per branch, noted with the billing period. They are seeded independently of the daily meal spend, and a day's items are sorted by time.
- Deposits page UI: pending audited days with covered-day selection, live match/discrepancy indicator against the expected total, required deposit-slip photo, recent deposits with Matched/Discrepancy status.
- Account page UI: profile, change password, sign out.
- History page UI: per-branch day-by-day audit list (gross sales, expected deposit, actual deposit, status: Open / Pending deposit / Matched / Discrepancy) with branch, date-range, and status filters. Day status comes from a single mock source (`dayAuditFor`) so pages stay consistent.
- Admin (owner) area under `/admin`, in its own `AdminShell` (desktop sidebar + mobile top bar/bottom tabs, "Owner" badge) separate from the branch-manager shell. Reachable via an "Owner view" link on the login page (no real role-based auth yet). Pages:
  - **Overview** (`/admin`): the same gross-sales chart as the manager dashboard, driven by the shared `SalesChart` component + `resolveRange` (`src/lib/dateRange.ts`), with branch and date-range filters. Below it, a combined table of gross sales, expenses, and expected deposit — one row per branch when "All branches", one row per day when a single branch is selected — with a totals row.
  - **History** (`/admin/history`): all-branches reconciliation list (per branch, per day: gross, expected, deposited, status) with branch, date-range, and status filters.
  - **Managers** (`/admin/managers`): branch-manager accounts (`MANAGERS` mock) with an "issue account" form.
  - **Settings** (`/admin/settings`): branches, Loyverse POS connection, expense categories, and reconciliation rules.
  - **Account** (`/admin/account`): owner profile, change password, sign out.
- Shared chart/date logic, used by both the manager dashboard and the owner overview so the two stay identical:
  - `src/components/SalesChart.tsx` — recharts smooth area chart (hourly points for a single day, one point per day for ranges).
  - `src/components/DateRangePicker.tsx` — Loyverse-style range picker: month calendar with the selected range banded, start/end date inputs, and presets (Today, Yesterday, This week, Last week, This month, Last month, Last 7 days, Last 30 days). Future days are disabled. Renders as a bottom sheet on mobile and an anchored popover on desktop, via a portal to `document.body` (an ancestor's `.anim-rise` leaves a transform that would otherwise trap `position: fixed`).
  - `src/lib/dateRange.ts` — `DateRange`, `PRESETS`/`presetRange`, `rangeDays` (clamped to today, capped at 92 days), and `rangeLabel`.
- Wide-screen layout system (both shells): `<main>` grows `max-w-5xl` → `xl:max-w-7xl` → `2xl:max-w-[90rem]`. Multi-column layouts activate at **`xl`**, not `lg`, because the `w-60` sidebar (`lg:pl-60`) leaves too little room at 1024px. Three patterns, applied consistently:
  - *Full-bleed* — the chart and wide tabular lists keep the full width (their row grids are viewport-based `sm:` grids, so they must not be squeezed into a narrow column).
  - *Even pair* (`xl:grid-cols-2`) — Expenses (form + recent), Managers (team + issue), Settings (4 cards as 2×2), Account (profile + password + session).
  - *Main + rail* (`xl:grid-cols-[1.6fr_1fr]` / `[1.7fr_1fr]`) — a wide list beside a narrow `StatCard` summary: Dashboard and Admin Overview ("Range at a glance"), both History pages ("In this range" status counts).
  All grids use `items-start` and `gap-5`; paired sections drop their `mt-5` since the grid gap handles spacing. `src/components/StatCard.tsx` is the shared label/value rail card. The chart also grows taller at `xl`/`2xl`.
- Long lists are paged, not infinitely scrolled, so page height stays constant: `src/components/Pagination.tsx` (20 rows per page) on the Dashboard summary, Admin Overview table, and both History pages. It renders nothing when everything fits on one page, and its `page`/`pageSize`/`total` props map 1:1 onto an offset+limit API call — server-side paging will swap the data source, not the component. Filter changes reset to page 1, and the page index is clamped so a shrinking result set can never strand you on an empty page. History ranges now reach `Last 90 days` and `This year` (a year across all branches is ~1,100 rows); the summary rail counts the whole filtered range, not just the visible page.
- Routing: react-router-dom ("/" dashboard, "/expenses", "/deposits", "/history", "/account" in the manager shell; "/admin/*" in the owner shell; "/login" standalone). Charts: recharts (route-split so only the manager dashboard and the owner overview load it). All data is deterministic mock (`src/lib/mock.ts`); no backend yet: authentication, Loyverse integration, and real persistence are still to be built.
