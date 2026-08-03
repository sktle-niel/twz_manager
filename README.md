# TWZ Manager

Daily sales audit and bank-deposit reconciliation for **Two Wheels Zone**, a multi-branch
motorcycle shop. It pulls each branch's sales from Loyverse POS, deducts the expenses the branch
logged that day, and checks every bank deposit against what the branch actually owed.

> **Status: front end only.** Every figure in the app is deterministic sample data from
> `src/lib/mock.ts` — seeded from the branch id and the date, so the same day always shows the same
> numbers. There is no backend yet: no authentication, no Loyverse integration, no persistence.

## The problem it replaces

Today the process is done by hand. Every night a branch lists the day's sales and expenses on
paper, deposits the earnings at the bank, photographs the deposit slip, and sends the photo to the
owner. It is slow, easy to get wrong, and gives the owner no reliable way to check that what was
deposited matches what the branch earned.

Sales are already in Loyverse POS, so nothing needs to be keyed in twice — the gap is everything
that happens *after* the sale.

## How it works

```
Expected deposit  =  Loyverse POS sales for the day  −  approved expenses
```

1. **Sales** flow in from the POS and are tracked through the day, per branch.
2. **Expenses** are logged as they happen. Meals and merienda are company-covered and go in
   without a receipt; every other category needs one. Both are deducted automatically.
3. **Deposits** are recorded with the amount, a reference, and a photo of the slip. A deposit is
   not always daily — a branch can batch up to ~3 days, so one deposit can cover several audited
   days, and the manager picks which.
4. **Reconciliation** compares the deposit against the sum expected for the days it covers. A
   match closes them. A mismatch cannot be closed silently: the app requires a discrepancy form
   with a reason and a receipt.

## The two sides

**Branch manager** — locked to the one branch their account was issued for; the branch is never a
choice in the UI.

| Route | What it does |
|---|---|
| `/` | Gross sales chart, per-day summary, and a status rail of what needs acting on today |
| `/expenses` | Batch expense entry, back-dating to any day still awaiting a deposit, per-row edit and delete |
| `/deposits` | Every audited day not yet covered, live match check, deposit slip upload |
| `/history` | Day-by-day audit table with status and the deposit receipt |
| `/account` | Profile, password, sign out, and the sign-in log (device, IP, when) |

**Owner** — spans every branch, under `/admin`.

| Route | What it does |
|---|---|
| `/admin` | Sales chart and table across branches, plus a highest-first branch ranking |
| `/admin/history` | The same audit table with a branch column |
| `/admin/managers` | Issue and reassign branch-manager accounts (one branch each) |
| `/admin/settings` | Branches, POS connection, expense categories, reconciliation rules |

## Running it

Needs Node 20 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
```

Sign-in accepts any username or Gmail and resolves it against the sample accounts — try
`marvin.deocampo` (Arevalo), `joel.sarabia` (Molo), or `rhea.villanueva` (Jaro) to switch which
branch you are looking at. Anything unrecognised falls back to the first account. The **Owner
view** link on the sign-in page opens the admin area; there is no role check behind it yet.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · react-router · recharts · GSAP ·
[Phosphor](https://phosphoricons.com) icons. Ships as an installable PWA, because the team cannot
build a native app yet — phones are the primary target, laptops work too.

## Layout

```
src/
  components/   shells, cards, dialogs, and the custom Select/DateRangePicker
  pages/        one file per route
  lib/
    mock.ts       all sample data, seeded and deterministic
    notices.ts    what a branch needs to act on, derived from the mock
    dateRange.ts  the shared range model behind both charts
    session.ts    the signed-in manager and their branch
    motion.ts     GSAP tokens, the reduced-motion opt-out, and the shared hooks
    format.ts     peso, dates, relative times
```

[`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) is the long version — the domain rules in full, and a
running record of what is built and why each decision went the way it did.
