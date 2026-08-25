/*
 * Reads the machine-printed validation off a deposit slip and offers the
 * figures back to the form.
 *
 * The branches' slips are filled in by hand and then validated by the bank's
 * printer, so this reads the *printed* part on purpose. That is the better
 * half to trust anyway: it is what the bank actually processed, not what the
 * manager wrote down. Handwriting is beyond Tesseract and is not attempted.
 *
 * The figures are a proposal, never an answer: they land in the form for the
 * manager to check, the raw text is kept so a wrong read can be seen rather
 * than guessed at, and the expected total is deliberately NOT used to choose
 * between candidates — letting it pick the reading that happens to match
 * would quietly bury the discrepancies this app exists to surface.
 *
 * The wording, though, is a verdict. The pixel checks in slipCheck can tell
 * paper from a wall but not a bank slip from a grocery receipt — only the
 * words can, and they are read here anyway. Each bank prints its own form,
 * so the page is read for every bank's wording separately; `foldBank` then
 * judges the branch's own bank's read exactly as before (none of its wording
 * blocks, traces warn, the form passes) and uses the other banks' reads for
 * one more finding: a page that is plainly the *other* bank's form went to
 * an account the owner is not watching, and blocks too.
 */
import type { Bank } from "./api/types"
import { BANKS, BANK_IDS } from "./banks"
import { loadImage } from "./slipCheck"
import type { SlipFinding, SlipLevel, SlipReport } from "./slipCheck"

export type BankKind = "slip" | "unsure" | "other"

/* One bank's marks against the page */
export type BankRead = {
  /* "slip" — this bank's own form wording is on the page; "unsure" — traces
     of it; "other" — none of it, whatever else the page may be */
  kind: BankKind
  /* Which marks hit, for the calibration script and the curious */
  matched: string[]
  /* How many of them name the bank or the form itself */
  strong: number
}

export type BankVerdict = {
  /* The firmest read across every bank — what the page most looks like */
  kind: BankKind
  /* Whose form that is. Null when no bank's wording was found at all. */
  bank: Bank | null
  matched: string[]
  /* Every bank's own read, so a branch can be judged on its bank's wording
     alone rather than on whatever the page most resembles */
  reads: Record<Bank, BankRead>
}

export type SlipFields = {
  amount: number | null
  date: Date | null
  /* Tesseract's own 0-100 score for the page */
  confidence: number
  /* Kept so a bad parse can be diagnosed */
  text: string
  /* Whether the page carries a bank form's wording at all, and whose */
  bank: BankVerdict
  failed: boolean
}

const NO_READ: BankRead = { kind: "other", matched: [], strong: 0 }

const EMPTY: SlipFields = {
  amount: null,
  date: null,
  confidence: 0,
  text: "",
  bank: { kind: "other", bank: null, matched: [], reads: { bdo: NO_READ, bpi: NO_READ } },
  failed: true,
}

/* Tesseract wants text around 300dpi; phone photos of a slip land near that
   once the long edge is here */
const OCR_EDGE = 1600
/* Percentile clipped off each end before stretching contrast, so one glare
   spot or one dark corner cannot flatten the rest */
const CLIP = 0.02

/* A deposit is a business figure, not a serial number */
const AMOUNT_MIN = 100
const AMOUNT_MAX = 10_000_000
/* A slip dated further out than this is not for this deposit */
const DATE_BACK_DAYS = 120
const DATE_FORWARD_DAYS = 2

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const AMOUNT_WORDS = ["amount", "total", "cash", "deposit", "credit", "php", "peso"]

/*
 * The words of each bank's form, grouped by what they prove. Strong marks name
 * the bank or the form itself; the rest are the form's printed labels and the
 * validation line's vocabulary, words a shop receipt has no reason to carry.
 * Generic receipt words ("total amount", "php") are in the lists but
 * deliberately cannot pass on their own: they raise the count, never clear
 * the bar. BPI's marks go one step further and flag the words every BPI
 * paper carries ("php", "thank you for banking with us", the PDIC line) as
 * `generic`, which the brand rule then ignores — or a BPI ATM receipt saying
 * "BPI … PHP … thank you for banking" would read as the deposit receipt.
 */
type BankMark = {
  name: string
  strong: boolean
  phrases: string[]
  words: string[]
  generic?: true
}

/* BDO Network Bank's cash transaction slip — the branches' own stationery.
   Calibrated against the real photographed slip, so nothing here is flagged
   generic: a BDO branch must be judged exactly as it was before there were
   two banks. */
const BDO_MARKS: BankMark[] = [
  { name: "BDO", strong: true, phrases: ["banco de oro"], words: ["bdo"] },
  { name: "Network Bank", strong: true, phrases: ["network bank"], words: [] },
  { name: "Transaction Slip", strong: true, phrases: ["transaction slip", "cash transaction"], words: [] },
  { name: "Account Name", strong: false, phrases: ["account name"], words: [] },
  { name: "Account No", strong: false, phrases: ["account no"], words: [] },
  { name: "Payor", strong: false, phrases: ["payor"], words: [] },
  { name: "Machine Validation", strong: false, phrases: ["machine validat"], words: [] },
  { name: "Denomination", strong: false, phrases: ["denomination"], words: [] },
  { name: "Total Amount", strong: false, phrases: ["total amount"], words: [] },
  { name: "Cash Deposit", strong: false, phrases: ["cash deposit"], words: [] },
  { name: "Cash In", strong: false, phrases: ["cash in"], words: [] },
  { name: "Savings Acct", strong: false, phrases: ["savings acct"], words: [] },
  { name: "Separate Slips", strong: false, phrases: ["separate slip"], words: [] },
  { name: "Institution Code", strong: false, phrases: ["institution code"], words: [] },
  { name: "Subscriber", strong: false, phrases: ["subscriber"], words: [] },
  { name: "Borrower", strong: false, phrases: ["borrower"], words: [] },
  { name: "Promissory", strong: false, phrases: ["promissory"], words: [] },
  { name: "Company Name", strong: false, phrases: ["company name"], words: [] },
  { name: "PHP", strong: false, phrases: [], words: ["php"] },
]

/*
 * BPI's deposit/payment receipt — the teller's machine-validated strip. The
 * brand is a logo, not text, and the header ("DEPOSIT/PAYMENT RECEIPT",
 * "CLIENT'S COPY") prints small and light, so Tesseract routinely misses
 * both; the marks lean on the body wording, which reads reliably: the
 * "valued customer" notice, the teller's counter and validation labels, and
 * the Customer Transaction Assistant Machine line no other paper carries.
 * The form-title mark is the slashed "deposit/payment" only — a bare
 * "payment receipt" is what every utility and bayad-center receipt says.
 */
const BPI_MARKS: BankMark[] = [
  { name: "BPI", strong: true, phrases: ["bank of the philippine islands", "philippine islands"], words: ["bpi"] },
  {
    name: "Deposit/Payment Receipt",
    strong: true,
    phrases: ["deposit/payment", "deposit / payment", "deposit/ payment", "deposit /payment"],
    words: [],
  },
  {
    name: "Teller's Validation",
    strong: true,
    phrases: ["teller's validation", "tellers validation", "teller s validation", "teller validation"],
    words: [],
  },
  {
    name: "Transaction Assistant Machine",
    strong: true,
    phrases: ["transaction assistant", "assistant machine"],
    words: [],
  },
  { name: "Client's Copy", strong: false, phrases: ["client's copy", "clients copy", "client s copy", "client copy"], words: [] },
  { name: "Valued Customer", strong: false, phrases: ["valued customer"], words: [] },
  {
    name: "Teller's Counter",
    strong: false,
    phrases: ["teller's counter", "tellers counter", "teller s counter", "teller counter"],
    words: [],
  },
  /* Matched as the notice phrases them ("NAME, ACCOUNT NUMBER or REFERENCE
     NUMBER, AMOUNT"), not as bare labels — a GCash screenshot or a utility
     bill carries "Reference Number" and "Account Number" too */
  {
    name: "Account Number",
    strong: false,
    phrases: ["name, account number", "name account number", "account number or"],
    words: [],
  },
  {
    name: "Reference Number",
    strong: false,
    phrases: ["or reference number", "reference number, amount", "reference number amount"],
    words: [],
  },
  { name: "Machine Validated", strong: false, phrases: ["machine validated", "your receipt when"], words: [] },
  { name: "Covering This Account", strong: false, phrases: ["covering this account", "subject to the terms"], words: [] },
  /* Printed on every BPI paper — ATM receipts and statements included */
  { name: "Banking With Us", strong: false, phrases: ["banking with us", "thank you for banking"], words: [], generic: true },
  { name: "PDIC", strong: false, phrases: ["deposit insurance", "insurance corporation", "each depositor"], words: ["pdic"], generic: true },
  { name: "PHP", strong: false, phrases: [], words: ["php"], generic: true },
]

const BANK_MARKS: Record<Bank, BankMark[]> = { bdo: BDO_MARKS, bpi: BPI_MARKS }

/* A brand or form-title mark plus this many form-specific marks reads as the
   slip — generic marks do not count here, or the brand on any of the bank's
   other papers would carry the verdict */
const SLIP_WITH_BRAND = 3
/* This many of the form's own labels can only be the slip, brand read or not
   — set above anything a shop receipt's "total amount" and "php" can reach */
const SLIP_WITHOUT_BRAND = 5
/* Below this the page shows essentially none of the slip's wording */
const UNSURE_FLOOR = 3

/* The letter-for-digit swaps OCR makes on clean print, folded back so a
   misread "BD0" still counts as the brand */
const LETTER_FOLD: [RegExp, string][] = [
  [/0/g, "o"],
  [/1/g, "l"],
  [/5/g, "s"],
  [/8/g, "b"],
]

/* One bank's marks against the page: how many hit, and how many of them
   name the bank or the form */
function readBank(bank: Bank, plain: string, folded: string): BankRead {
  const has = (needle: string) => plain.includes(needle) || folded.includes(needle)
  const hasWord = (word: string) => {
    const bounded = new RegExp(`\\b${word}\\b`)
    return bounded.test(plain) || bounded.test(folded)
  }

  const matched = BANK_MARKS[bank].filter(
    (mark) => mark.phrases.some(has) || mark.words.some(hasWord),
  )
  const strong = matched.filter((mark) => mark.strong).length
  const specific = matched.filter((mark) => !mark.generic).length
  const names = matched.map((mark) => mark.name)

  if ((strong > 0 && specific >= SLIP_WITH_BRAND) || matched.length >= SLIP_WITHOUT_BRAND) {
    return { kind: "slip", matched: names, strong }
  }
  if (strong > 0 || matched.length >= UNSURE_FLOOR) {
    return { kind: "unsure", matched: names, strong }
  }
  return { kind: "other", matched: names, strong }
}

const KIND_RANK: Record<BankKind, number> = { slip: 2, unsure: 1, other: 0 }

/* Which of two reads to believe: the firmer verdict, then the one with more
   of its form's own names on the page */
function firmer(a: BankRead, b: BankRead): boolean {
  if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] > KIND_RANK[b.kind]
  if (a.strong !== b.strong) return a.strong > b.strong
  return a.matched.length > b.matched.length
}

/*
 * Every bank read against the page, and which one it most looks like. Each
 * bank's read stands on its own — a branch is judged on its bank's wording,
 * never softened by the other bank's — and the firmest of them is what lets
 * the wrong bank's form be named out loud.
 */
export function bankVerdict(text: string): BankVerdict {
  /* Curly quotes and stray backticks are how OCR renders the apostrophe in
     "Teller's"; folded to one shape so the marks need not list them all */
  const plain = text
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, " ")
  const folded = LETTER_FOLD.reduce((t, [digit, letter]) => t.replace(digit, letter), plain)

  const reads = Object.fromEntries(
    BANK_IDS.map((bank) => [bank, readBank(bank, plain, folded)]),
  ) as Record<Bank, BankRead>
  const bestBank = BANK_IDS.reduce((top, bank) => (firmer(reads[bank], reads[top]) ? bank : top))
  const best = reads[bestBank]

  return {
    kind: best.kind,
    bank: best.kind === "other" ? null : bestBank,
    matched: best.matched,
    reads,
  }
}

/* The firmest read among the banks this branch does NOT deposit to */
function otherBankRead(verdict: BankVerdict, expected: Bank): { bank: Bank; read: BankRead } | null {
  let top: { bank: Bank; read: BankRead } | null = null
  for (const bank of BANK_IDS) {
    if (bank === expected) continue
    const read = verdict.reads[bank]
    if (!top || firmer(read, top.read)) top = { bank, read }
  }
  return top
}

/*
 * Whether the figures on this page may be offered to the form: only off a
 * page the branch's bank finding lets through. A page that is not a slip at
 * all, or is plainly the other bank's, offers nothing — a grocery total
 * landing in the amount field would be worse than nothing.
 */
export function slipAccepted(fields: SlipFields, expected: Bank): boolean {
  if (fields.failed) return false
  const finding = bankFinding(fields, expected)
  return finding === null || finding.level !== "fail"
}

/* The worker downloads a few MB of wasm and language data on first use, so it
   is created once and kept. The import is dynamic to keep all of it out of the
   main bundle — a manager who never records a deposit never pays for it. */
type OcrWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>
let workerPromise: Promise<OcrWorker> | null = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js")
      return createWorker("eng")
    })()
    workerPromise.catch(() => {
      // Let the next attempt rebuild rather than caching the failure forever
      workerPromise = null
    })
  }
  return workerPromise
}

/*
 * Upscale, flatten to grey, and stretch the contrast. A validation line is
 * often faint dot-matrix over a printed form, and Tesseract reads it far more
 * reliably once the ink and the paper are pushed apart.
 */
async function prepare(file: File): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(file)
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = Math.min(3, Math.max(1, OCR_EDGE / longest))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)

  const frame = ctx.getImageData(0, 0, w, h)
  const px = frame.data
  const total = w * h
  const hist = new Array<number>(256).fill(0)
  const gray = new Uint8ClampedArray(total)

  for (let i = 0; i < total; i++) {
    const p = i * 4
    const v = Math.round(0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2])
    gray[i] = v
    hist[v]++
  }

  const clip = Math.floor(total * CLIP)
  let low = 0
  let high = 255
  for (let seen = 0, v = 0; v < 256; v++) {
    seen += hist[v]
    if (seen > clip) {
      low = v
      break
    }
  }
  for (let seen = 0, v = 255; v >= 0; v--) {
    seen += hist[v]
    if (seen > clip) {
      high = v
      break
    }
  }
  const range = Math.max(1, high - low)

  for (let i = 0; i < total; i++) {
    const v = Math.min(255, Math.max(0, ((gray[i] - low) / range) * 255))
    const p = i * 4
    px[p] = v
    px[p + 1] = v
    px[p + 2] = v
  }
  ctx.putImageData(frame, 0, 0)
  return canvas
}

/* How close a keyword sits to a match, as a score that fades with distance */
function nearWord(text: string, at: number, words: string[]): number {
  const window = text.slice(Math.max(0, at - 40), at).toLowerCase()
  for (const w of words) {
    const found = window.lastIndexOf(w)
    if (found >= 0) return 1 - (window.length - found) / 60
  }
  return 0
}

function pickAmount(text: string): number | null {
  // Grouped thousands, or a bare figure with centavos — both as printed
  const pattern = /\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|\b\d{3,9}\.\d{2}\b/g
  let best: { value: number; score: number } | null = null

  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    const raw = m[0]
    /* A figure that continues a dotted or dashed run of digits on either side
       is the tail of something longer — an account number with its dashes
       read as dots ("0102433.0605.39"), or thousands grouped with a dot
       ("12.500.00") — and offering its tail as the amount is worse than
       leaving the field for the manager. Written as slices rather than a
       lookbehind, which older phone browsers still choke on. */
    const before = text.slice(Math.max(0, m.index - 2), m.index)
    const after = text.slice(m.index + raw.length, m.index + raw.length + 2)
    if (/[\d.,-][.,-]$/.test(before) || /^[.,-]\d/.test(after)) continue

    const value = Number(raw.replace(/,/g, ""))
    if (!Number.isFinite(value) || value < AMOUNT_MIN || value > AMOUNT_MAX) continue

    // Keyword proximity leads; centavos and grouping are the marks of a money
    // field rather than an account number; size breaks the remaining ties
    const score =
      nearWord(text, m.index, AMOUNT_WORDS) * 3 +
      (raw.includes(".") ? 1.5 : 0) +
      (raw.includes(",") ? 1 : 0) +
      Math.min(1, value / AMOUNT_MAX)

    if (!best || score > best.score) best = { value, score }
  }
  return best ? Math.round(best.value) : null
}

function plausible(d: Date, now: Date): boolean {
  const days = (now.getTime() - d.getTime()) / 86_400_000
  return days >= -DATE_FORWARD_DAYS && days <= DATE_BACK_DAYS
}

function fullYear(raw: string): number {
  const n = Number(raw)
  return raw.length === 2 ? 2000 + n : n
}

function pickDate(text: string, now: Date): Date | null {
  const found: Date[] = []

  // 2026-08-03
  for (const m of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    found.push(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  }
  // 08/03/2026 and 03/08/26 — a first field over 12 can only be the day
  for (const m of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    const a = Number(m[1])
    const b = Number(m[2])
    const year = fullYear(m[3])
    found.push(a > 12 ? new Date(year, b - 1, a) : new Date(year, a - 1, b))
  }
  // 03AUG26, 03 AUG 2026, AUG 03 2026. The year ends at the next non-digit
  // rather than a word boundary: BPI's validation line runs the date into an
  // underscore-like mark ("28APR16_"), which is not a boundary to a regex.
  for (const m of text.matchAll(/\b(\d{1,2})\s*([A-Za-z]{3})\s*(\d{2,4})(?!\d)/g)) {
    const month = MONTHS.indexOf(m[2].toLowerCase())
    if (month >= 0) found.push(new Date(fullYear(m[3]), month, Number(m[1])))
  }
  for (const m of text.matchAll(/\b([A-Za-z]{3})\s*(\d{1,2})[,\s]+(\d{2,4})(?!\d)/g)) {
    const month = MONTHS.indexOf(m[1].toLowerCase())
    if (month >= 0) found.push(new Date(fullYear(m[3]), month, Number(m[2])))
  }

  const usable = found.filter((d) => !Number.isNaN(d.getTime()) && plausible(d, now))
  if (usable.length === 0) return null
  // The most recent plausible date: a slip carries its validation date beside
  // older ones, like a statement period or a printed form revision
  return usable.reduce((latest, d) => (d > latest ? d : latest), usable[0])
}

/*
 * The parsing is the part that gets a figure wrong, and it is pure string work,
 * so it is exposed for the calibration script rather than only reachable
 * behind a several-megabyte OCR download.
 */
export function __parseForTest(text: string, now: Date) {
  const amount = pickAmount(text)
  return { amount, date: pickDate(text, now) }
}

function turned(source: HTMLCanvasElement, deg: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement("canvas")
  const swap = deg !== 180
  out.width = swap ? source.height : source.width
  out.height = swap ? source.width : source.height
  const ctx = out.getContext("2d")
  if (!ctx) return source
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return out
}

type Attempt = { text: string; confidence: number; bank: BankVerdict }

export async function readSlip(file: File, now: Date): Promise<SlipFields> {
  let canvas: HTMLCanvasElement | null
  try {
    canvas = await prepare(file)
  } catch {
    return EMPTY
  }
  if (!canvas) return EMPTY

  try {
    const worker = await getWorker()

    /* A slip photographed sideways OCRs to noise, so each frame that shows
       none of a bank's wording is turned and read again before the verdict
       stands. A real slip — either bank's — stops at the first upright pass;
       only a page that is genuinely not a slip pays for all four. */
    let best: Attempt | null = null
    for (const turn of [0, 90, 270, 180] as const) {
      const frame = turn === 0 ? canvas : turned(canvas, turn)
      const { data } = await worker.recognize(frame)
      const attempt: Attempt = {
        text: data.text ?? "",
        confidence: Math.round(data.confidence ?? 0),
        bank: bankVerdict(data.text ?? ""),
      }
      if (
        !best ||
        KIND_RANK[attempt.bank.kind] > KIND_RANK[best.bank.kind] ||
        (attempt.bank.kind === best.bank.kind && attempt.confidence > best.confidence)
      ) {
        best = attempt
      }
      if (best.bank.kind === "slip") break
    }
    if (!best) return EMPTY

    const amount = pickAmount(best.text)
    return {
      amount,
      date: pickDate(best.text, now),
      confidence: best.confidence,
      text: best.text,
      bank: best.bank,
      failed: false,
    }
  } catch {
    return EMPTY
  }
}

/*
 * The reading folded back into the slip report, once it exists, judged
 * against the bank this branch deposits to. Two findings block: "none of this
 * bank's wording anywhere on the page", and "plainly the other bank's form" —
 * each is as close to a fact as reading gets, and the second is a deposit
 * that went to an account the owner is not watching. Traces of the wording,
 * or a reader that could not run at all, warn and go through: stranding a
 * manager over a faint print would cost more than a slip the owner asks about.
 */
export function foldBank(report: SlipReport, fields: SlipFields, expected: Bank): SlipReport {
  const finding = bankFinding(fields, expected)
  if (finding === null) {
    const paper = BANKS[expected]
    return report.level === "ok"
      ? { ...report, headline: `The photo reads as a ${paper.short} ${paper.paper}.` }
      : report
  }
  const findings = [...report.findings, finding]
  const level: SlipLevel = findings.some((f) => f.level === "fail") ? "fail" : "warn"
  return {
    ...report,
    level,
    findings,
    headline: level === "fail" ? finding.title : "Check the photo before recording",
  }
}

/*
 * The branch's own bank is judged on its own read, exactly as it was before
 * there were two banks — the other bank's wording never softens or hardens
 * it. The other bank's read adds only two things: a firmer "slip" than ours
 * is the wrong form and blocks; traces of it are named in the message so a
 * dim photo of the wrong paper is not waved through with a reassuring line.
 */
function bankFinding(fields: SlipFields, expected: Bank): SlipFinding | null {
  const want = BANKS[expected]
  if (fields.failed) {
    return {
      id: "bank",
      level: "warn",
      title: "The wording could not be checked",
      detail: `The reader did not run on this device, so make sure the photo is the ${want.short} ${want.paper} itself.`,
    }
  }
  const mine = fields.bank.reads[expected]
  const other = otherBankRead(fields.bank, expected)
  const got = other ? BANKS[other.bank] : null

  if (other && got && other.read.kind === "slip" && firmer(other.read, mine)) {
    return {
      id: "bank",
      level: "fail",
      title: `This reads as a ${got.short} ${got.paper}, not ${want.short}'s`,
      detail: `This branch deposits to ${want.name}, so its ${want.paper} is what goes on file. If the money really went to ${got.name}, tell the owner — the branch's bank is set in Settings.`,
    }
  }
  if (mine.kind === "slip") return null

  const otherTraces = other && got && other.read.kind === "unsure" ? got : null
  if (mine.kind === "other") {
    return otherTraces
      ? {
          id: "bank",
          level: "fail",
          title: `This may be a ${otherTraces.short} ${otherTraces.paper}, not ${want.short}'s`,
          detail: `Traces of ${otherTraces.name}'s wording were read and none of the ${want.short} ${want.paper}'s. Photograph the ${want.name} ${want.paper} itself — whole, filling the frame, in even light. If the money really went to ${otherTraces.name}, tell the owner.`,
        }
      : {
          id: "bank",
          level: "fail",
          title: `This does not read as a ${want.short} ${want.paper}`,
          detail: `None of the ${want.paper}'s printed wording was found in the photo. Photograph the ${want.name} ${want.paper} itself — whole, filling the frame, in even light.`,
        }
  }
  return {
    id: "bank",
    level: "warn",
    title: `Hard to confirm this is the ${want.short} ${want.paper}`,
    detail: `Only a little of the ${want.paper}'s printed wording could be read.${
      otherTraces ? ` Some of what was read looks like ${otherTraces.name}'s.` : ""
    } Make sure this is the ${want.name} ${want.paper} — a clearer photo helps the owner read it too.`,
  }
}
