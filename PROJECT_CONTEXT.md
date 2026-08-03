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
2. **Expense logging** — Branches record daily expenses (food and any other expense). The company covers meals and snacks (merienda) for staff, so these are legitimate expenses that are **automatically deducted** from the amount expected to be deposited. Every expense entry requires a **receipt attachment**, except staff meals and merienda — those are company-covered and are logged without one.
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
- Meals and merienda are company-covered: logged as expenses **without a receipt** and deducted automatically from the expected deposit.
- Receipts/attachments are required evidence for expenses (except meals and merienda), deposits, and discrepancies.

## Technical notes

- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS v4. Icons: `@phosphor-icons/react`.
- **Motion:** GSAP + `@gsap/react`, with everything sequenced living in `src/lib/motion.ts` — the tokens (`EASE = "expo.out"`, which is the same `cubic-bezier(0.16, 1, 0.3, 1)` as the CSS `--ease-quiet`), the `prefers-reduced-motion` opt-out, and two shared hooks: `useRouteReveal` (one staggered fade-up over every `[data-rise]` in the shell's `<main>`, keyed on the path) and `useSheetEnter` (backdrop fade + panel rise on one timeline). The toast's card/ring/tick and the two popovers hold their own tweens. CSS keeps only hover and focus transitions. Every tween is transform + opacity, and the reveal clears its inline transform on land so nothing is left as a containing block.
- **Platform:** PWA (installable on phones; works on laptops).
- **POS integration:** Loyverse POS is the source of truth for sales. Integration will use the Loyverse API (stores, receipts) — exact endpoints/auth to be confirmed during backend work.
- **Auth:** Sign in with username or Gmail + password. Branch managers get accounts issued by the owner, each **assigned to exactly one branch**. A manager only ever sees and edits their own branch's data (sales, expenses, deposits, history); the branch is fixed by their account, never chosen in the UI. Only the owner (admin) area spans every branch. (Auth backend not built yet — the login form validates client-side only, and a mock `SessionProvider` resolves the typed identifier to one of the sample manager accounts to pick the acting branch.)
- **Repo:** https://github.com/sktle-niel/twz_manager (branches: `main`, `development`).

## Current status (2026-07-24)

- Login page UI is built (light, minimal, formal design; brand green as accent).
- Branch access control: a mock session (`src/lib/session.ts` + `src/components/SessionProvider.tsx`) holds the signed-in manager and their assigned branch; `useSession()` exposes `{ manager, store, signInAs }`. Login resolves the identifier to an account (username or Gmail; falls back to the first sample manager). The manager pages (Dashboard, Expenses, Deposits, History, Account) read the branch from the session and are **locked to it** — the old branch `<select>` is replaced by a read-only `BranchTag`, and the manager shell shows the branch as a badge by the logo. The owner area is unchanged and still spans all branches with its "All branches" filter.
- Dashboard UI is built with mock data: gross sales area chart (hourly points for a single day, one point per day for ranges), the branch fixed to the signed-in manager, a Loyverse-style date-range picker, and a per-day summary list (gross sales, expenses, expected deposit).
- The dashboard's right-hand rail is the branch's **status**, not a restatement of the chart. Two cards:
  - **Status** (`src/components/NoticeCard.tsx`) — one row per thing that needs acting on, built by `branchNotices()` in `src/lib/notices.ts` from the same mock the pages read, so the card can never disagree with them: today's expenses unlogged (or logged, with the running total), earlier not-yet-deposited days with **nothing logged**, the deposit backlog and what is due (flagged past the usual 3-day batching window), the most recent deposit that came up **short** with its reference, how far today's sales have synced from the POS, and a **sign-in from another device**. Each row carries a tone — claret `alert` / mute `info` / sage `ok` — and rows with a fix link straight to it (`/expenses`, `/deposits`, `/history`). Sorted alerts → info → ok. This is the one source a bell icon or push notification should read from later.
  - **Sign-in activity** (`src/components/SignInCard.tsx`) — device, platform, IP (mono), place, and relative time per sign-in, with the current session tagged "This device". Backed by `signInLogFor(managerId, now)` in `src/lib/mock.ts`, seeded per account like every other figure; the real list will come from the auth backend's session records. `timeAgo()`/`clockLabel()` in `src/lib/format.ts` do the labelling, taking `now` as an argument so the caller can freeze it (the page holds it in `useState(() => new Date())`).
- App shell: sidebar navigation on desktop (Dashboard, Expenses, Deposits, History, Account); iOS-style bottom tab bar on mobile (Dashboard, Expenses, center "New entry" button opening a sheet, Deposits, History) with Account in the top-right of the mobile header.
- Expenses page UI: batch entry form plus the selected day's list. A manager logging on the way home fills the fields and presses **Enter** (or "Add another expense") to queue a line — merienda, then meals, then an Other — into a "Ready to save" list with a running total and per-line remove, then commits the whole evening with **one** "Save N expenses". A filled-but-unqueued form is included on save, so nothing typed is silently lost.
- Expenses can be back-dated: a **Date** select offers today plus every day still awaiting a deposit (`pendingDepositDays()`, the same source the Deposits page reads), so a day missed six days ago is still reachable. Reconciled days are deliberately excluded — editing their expenses would move an expected deposit that has already been matched. The "Not yet deposited" panel lists those days with their totals as a quick day switcher, flagging any day with **nothing logged** (caution icon, claret "Nothing logged"). To give that flag something real to catch, the mock leaves `UNLOGGED_DAY` (4 days back) with no daily spend logged at all, plus a ~10% seeded chance on older days; utility bills are independent, so a bill can still land on an otherwise unlogged day.
- Every expense on a not-yet-deposited day can be corrected: each row carries a `RowMenu` (⋯) with **Edit** (an `ExpenseDialog` over amount, category, and note) and **Delete** (claret, destructive). Because a day's rows come from two places — logged this session and already in the mock — corrections are held as a per-day overrides layer (`DayEdits`: `added` / `removed` / `edited`, keyed by item id) so both kinds behave identically; the day total and the "Nothing logged" flag are derived from the result, so emptying a day re-raises its caution icon. Dates themselves are never deletable — the day rows only switch which day is being edited. Receipts are **multiple, up to 5** per expense, in both the log form and the edit dialog, via `src/components/ReceiptUploader.tsx` (a thumbnail grid with per-photo remove and an "Add photo" tile; the model lives in `src/lib/receipts.ts` as `ReceiptEntry[]`). `ExpenseItem.receiptCount` records how many are on file (mock rows carry 1 for every category except Meals and Merienda, matching the logging rule) and `receipts?: File[]` holds the actual files for rows attached this session — mock rows show framed "On file" placeholders instead, since there is nothing stored to hand back. A required category needs at least one, so switching a meal into a category that needs proof demands a receipt; photos can be removed or added but the count is the source of truth. Rows show a paperclip with the count when receipts are attached.
- Success feedback is a toast (`src/components/Toast.tsx`): a check that draws itself beside the message, **top-centre on every width**, portalled to the body and auto-dismissed. Its timer is held in a ref so a parent re-render cannot restart it, and it is mounted with a changing `key` so repeating the same message replays the animation. The tick's resting state is fully drawn (`stroke-dashoffset: 0`), so `prefers-reduced-motion` leaves a check rather than an empty ring. Currently used by the Expenses page; the other pages still show inline confirmations.
- Expenses page validation: amount is required, the note is always optional, and the receipt photo is required for every category **except Meals and Merienda** (`RECEIPT_OPTIONAL` in `ExpensesPage.tsx`) — the field relabels itself "(optional)" and any stale receipt error clears the moment one of those two is picked. Categories: Meals, Merienda, Water bill, Electric bill, Wifi bill, Other — each with its own icon, note placeholder, and default note used when the note is left blank. In the mock, the three utility bills are monthly rather than daily: electric on the 5th, water on the 10th, wifi on the 15th of each month, per branch, noted with the billing period. They are seeded independently of the daily meal spend, and a day's items are sorted by time.
- Deposits page UI: the "For deposit" list shows **every** audited day still uncovered by a deposit — derived from `pendingDepositDays()` in the mock rather than assuming a fixed 3-day window, so a branch that has not deposited in six days sees all six, and Deposits and History always agree. Past the usual batching window it flags the backlog ("6 days waiting"). Covered-day selection, live match/discrepancy indicator against the expected total, required amount, reference number, and deposit-slip photo; recent deposits with Matched/Discrepancy status. The sample timeline lives in one place, `DEPOSIT_TIMELINE` in `src/lib/mock.ts` (days 1–6 pending, 7–8 covered by one matched deposit, day 9 short by 180).
- Account page UI: profile, change password, sign out.
- History page UI (manager and owner): day-by-day audit table — Date, [Branch, in the owner view across all branches], Gross sales, Expected, Deposited, Status (Open / Pending deposit / Matched / Discrepancy), and a `RowMenu` (⋯) — with branch, date-range, and status filters. The menu carries what does not earn a column: "View receipt" opens `ReceiptDialog`, showing the branch, audited day, **reference number**, expected vs deposited, any shortfall, and a frame for the slip photo (the photo itself waits on backend uploads). The reference has no column of its own precisely because the dialog already carries it. Rows are shared by both pages via `src/components/AuditRow.tsx`; the columnar table turns on at `xl` and narrower screens get a stacked row with a direct "View receipt" link. Day status and reference come from a single mock source (`dayAuditFor`) so pages stay consistent — two days covered by one deposit carry the same reference.
- Admin (owner) area under `/admin`, in its own `AdminShell` (desktop sidebar + mobile top bar/bottom tabs, "Owner" badge) separate from the branch-manager shell. Reachable via an "Owner view" link on the login page (no real role-based auth yet). Pages:
  - **Overview** (`/admin`): the same gross-sales chart as the manager dashboard, driven by the shared `SalesChart` component + `resolveRange` (`src/lib/dateRange.ts`), with branch and date-range filters. Below it, a combined table of gross sales, expenses, and expected deposit — one row per branch when "All branches", one row per day when a single branch is selected — with a totals row. Its rail is **Sales by branch** (`src/components/BranchSalesCard.tsx`): what each branch took in over the selected range, **ranked highest first**, with each row's share of the total and a bar measured against the leader, and an all-branches total in the footer. It always lists every branch even when the page is filtered to one — comparing them is the point, so the filtered branch is only marked (sage row).
  - **History** (`/admin/history`): the same audit table as the manager view plus a Branch column when scoped to all branches.
  - **Managers** (`/admin/managers`): branch-manager accounts (`MANAGERS` mock) with an "issue account" form, and a **per-row branch selector** so the owner can reassign any manager's branch. Reassignments are held as an id-keyed override layer over the base list (so existing accounts move without editing the data); a toast confirms each change. Since the manager pages are locked to `session.store`, moving a manager here is what changes which branch's data they see. **Branch assignment is one-to-one.** The issue form offers only unassigned branches and disables itself with "Every branch already has a manager" when none are free. Reassigning an existing manager lists every branch: free ones move them, and a branch held by someone else **swaps** the two (the other manager takes the first one's old branch) — that is how a wrong assignment, e.g. two managers accidentally interchanged, gets corrected without ever doubling up. There are four branches (Arevalo, Molo, Jaro, La Paz) and three seed managers, so one branch starts free. Each row also has a **per-manager lock** (padlock button): rows are **locked by default** so a stray click can never move anyone — the admin unlocks a row to reassign it. A locked manager is also protected from swaps (their branch is dropped from every other row's options). The per-row branch selects share a fixed width so they line up, and the dropdown menu grows past the trigger width so a "Held by … · swaps" hint is never truncated.
  - **Settings** (`/admin/settings`): branches, Loyverse POS connection, expense categories, and reconciliation rules.
  - **Account** (`/admin/account`): owner profile, change password, sign out.
- Dropdowns are a custom listbox, `src/components/Select.tsx` — not native `<select>` — with styled options, a check on the current choice, full keyboard support (arrows/Home/End/Enter/Esc), and a body-portalled popover positioned from the trigger's rect (opens up or down by available space). `FilterSelect` is the filter-styled preset over it; both take an `options: SelectOption[]` array and an optional `className` (e.g. a fixed width) and `disabled`. The menu is at least as wide as its trigger but grows to fit the longest option (capped to the viewport), so option text is never truncated. Every dropdown in the app (filters, category, date, branch) routes through it.
- Shared chart/date logic, used by both the manager dashboard and the owner overview so the two stay identical:
  - `src/components/SalesChart.tsx` — recharts smooth area chart (hourly points for a single day, one point per day for ranges).
  - `src/components/DateRangePicker.tsx` — Loyverse-style range picker: month calendar with the selected range banded, start/end date inputs, and presets (Today, Yesterday, This week, Last week, This month, Last month, Last 7 days, Last 30 days). Future days are disabled. Renders as a bottom sheet on mobile and an anchored popover on desktop, via a portal to `document.body` (an ancestor's entry animation holds a transform while it runs, which would otherwise trap `position: fixed`).
  - `src/lib/dateRange.ts` — `DateRange`, `PRESETS`/`presetRange`, `rangeDays` (clamped to today, capped at 92 days), and `rangeLabel`.
- Wide-screen layout system (both shells): `<main>` grows `max-w-5xl` → `xl:max-w-7xl` → `2xl:max-w-[90rem]`. Multi-column layouts activate at **`xl`**, not `lg`, because the `w-60` sidebar (`lg:pl-60`) leaves too little room at 1024px. Three patterns, applied consistently:
  - *Full-bleed* — the chart and wide tabular lists keep the full width (their row grids are viewport-based `sm:` grids, so they must not be squeezed into a narrow column).
  - *Even pair* (`xl:grid-cols-2`) — Expenses (form + recent), Managers (team + issue), Settings (4 cards as 2×2), Account (profile + password + session).
  - *Main + rail* (`xl:grid-cols-[1.6fr_1fr]`) — a wide list beside a narrow rail: Dashboard (status + sign-in activity) and Admin Overview (sales by branch). On both, the **rail comes first in the DOM** and is put back on the right with `xl:order-1` / `xl:order-2`, so a phone gets what needs acting on before the long paged list.
  - The History tables use the same rail pattern at a wider ratio, `xl:grid-cols-[2fr_1fr]`, to leave their columns room. Their tracks are `minmax(fixed, fr)` rather than plain `fr`: the fixed minimum stops a column from being squeezed until its text collides with the neighbour, and text cells truncate. No audit track is ever `auto` — each row is its own grid, so an auto track follows that row's own status chip and knocks the money columns out of line with the row above.
  All grids use `items-start` and `gap-5`; paired sections drop their `mt-5` since the grid gap handles spacing. `src/components/StatCard.tsx` is the shared label/value rail card. The chart also grows taller at `xl`/`2xl`.
- Long lists are paged, not infinitely scrolled, so page height stays constant: `src/components/Pagination.tsx` (20 rows per page) on the Dashboard summary, Admin Overview table, and both History pages. It renders nothing when everything fits on one page, and its `page`/`pageSize`/`total` props map 1:1 onto an offset+limit API call — server-side paging will swap the data source, not the component. Filter changes reset to page 1, and the page index is clamped so a shrinking result set can never strand you on an empty page. History ranges now reach `Last 90 days` and `This year` (a year across all branches is ~1,100 rows); the summary rail counts the whole filtered range, not just the visible page.
- Routing: react-router-dom ("/" dashboard, "/expenses", "/deposits", "/history", "/account" in the manager shell; "/admin/*" in the owner shell; "/login" standalone). Charts: recharts (route-split so only the manager dashboard and the owner overview load it). All data is deterministic mock (`src/lib/mock.ts`); no backend yet: authentication, Loyverse integration, and real persistence are still to be built.
