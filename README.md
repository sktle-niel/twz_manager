# TWZ Manager

Daily sales audit and bank-deposit reconciliation for **Two Wheels Zone**, a multi-branch
motorcycle shop. It pulls each branch's sales from Loyverse POS, deducts the expenses the branch
logged that day, and checks every bank deposit against what the branch actually owed.

> **Status: front end only, backend-ready.** Every figure in the app is deterministic sample
> data, seeded from the branch id and the date, so the same day always shows the same numbers.
> There is no backend yet — but the full auth flow (sign-in, roles, sign-out, session expiry),
> every write, and every error path is wired to the contract a backend will implement.
>
> `src/lib/api/` is the seam where that backend plugs in — `contracts.ts` states what it must
> implement, [`docs/API.md`](docs/API.md) is the endpoint-by-endpoint spec to build from, and
> `VITE_DATA_SOURCE` chooses between the real client and the sample adapter.
> [`docs/LOYVERSE.md`](docs/LOYVERSE.md) is the POS integration study.

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
| `/admin/account` | Owner profile, password, sign out, and the sign-in log |

## Running it

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env.local   # keeps VITE_DATA_SOURCE=sample for development
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
```

Sample mode starts at the sign-in screen like the real thing — nothing inside is reachable
without an account. Known accounts are `marvin.deocampo` (Arevalo), `joel.sarabia` (Molo),
`rhea.villanueva` (Jaro), `testaccount` (La Paz), and **`twowheelszone`** for the owner side —
any password of 6+ characters works, and unknown identifiers are rejected the way a real
backend would. (Against the real backend the same usernames exist with real passwords; see its
README.) The session behaves like a session cookie: a reload keeps you signed in, closing the
tab ends it.

The routes are role-guarded: a manager account lands on `/` and cannot open `/admin`; the owner
lands on `/admin` and cannot open the manager side; signed out, everything walks you to
`/login`.

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
    api/
      contracts.ts  everything the app asks of a backend
      types.ts      the domain, with no mention of Loyverse
      client.ts     fetch, errors, uploads
      http.ts       the real adapter
      sample.ts     deterministic development data — delete with the backend
      index.ts      picks one from VITE_DATA_SOURCE
    useApi.ts     one read, with loading/error/reload
    notices.ts    what a branch needs to act on
    dateRange.ts  the shared range model behind both charts
    session.ts    useAuth for the login page and guards; narrowed per-role hooks for pages
    motion.ts     GSAP tokens, the reduced-motion opt-out, and the shared hooks
    format.ts     peso, dates, relative times
```

[`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) is the long version — the domain rules in full, and a
running record of what is built and why each decision went the way it did.
