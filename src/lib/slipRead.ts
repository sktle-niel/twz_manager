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
 * words can, and they are read here anyway. A page carrying none of the BDO
 * slip's own wording is not the slip, and `foldBank` turns that into the one
 * finding allowed to block on what was read.
 */
import { loadImage } from "./slipCheck"
import type { SlipFinding, SlipLevel, SlipReport } from "./slipCheck"

export type BankVerdict = {
  /* "slip" — the BDO slip's own wording is on the page; "unsure" — traces of
     it; "other" — none of it, whatever else the page may be */
  kind: "slip" | "unsure" | "other"
  /* Which marks hit, for the calibration script and the curious */
  matched: string[]
}

export type SlipFields = {
  amount: number | null
  reference: string | null
  date: Date | null
  /* Tesseract's own 0-100 score for the page */
  confidence: number
  /* Kept so a bad parse can be diagnosed */
  text: string
  /* Whether the page carries the BDO slip's wording at all */
  bank: BankVerdict
  failed: boolean
}

const EMPTY: SlipFields = {
  amount: null,
  reference: null,
  date: null,
  confidence: 0,
  text: "",
  bank: { kind: "other", matched: [] },
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
/* Reference numbers on a validation line */
const REF_MIN = 5
const REF_MAX = 20
/* A slip dated further out than this is not for this deposit */
const DATE_BACK_DAYS = 120
const DATE_FORWARD_DAYS = 2

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const AMOUNT_WORDS = ["amount", "total", "cash", "deposit", "credit", "php", "peso"]
const REF_WORDS = ["ref", "trn", "seq", "trace", "val", "trace", "transaction", "no."]

/*
 * The words of a BDO Network Bank cash transaction slip — the branches' own
 * stationery — grouped by what they prove. Strong marks name the bank or the
 * form itself; the rest are the form's printed labels and the validation
 * line's vocabulary, words a shop receipt has no reason to carry. Generic
 * receipt words ("total amount", "php") are in the list but deliberately
 * cannot pass on their own: they raise the count, never clear the bar.
 */
type BankMark = { name: string; strong: boolean; phrases: string[]; words: string[] }

const BANK_MARKS: BankMark[] = [
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

/* A brand or form-title mark plus this many marks in all reads as the slip */
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

export function bankVerdict(text: string): BankVerdict {
  const plain = text.toLowerCase().replace(/\s+/g, " ")
  const folded = LETTER_FOLD.reduce((t, [digit, letter]) => t.replace(digit, letter), plain)
  const has = (needle: string) => plain.includes(needle) || folded.includes(needle)
  const hasWord = (word: string) => {
    const bounded = new RegExp(`\\b${word}\\b`)
    return bounded.test(plain) || bounded.test(folded)
  }

  const matched = BANK_MARKS.filter(
    (mark) => mark.phrases.some(has) || mark.words.some(hasWord),
  )
  const strong = matched.filter((mark) => mark.strong).length
  const names = matched.map((mark) => mark.name)

  if ((strong > 0 && matched.length >= SLIP_WITH_BRAND) || matched.length >= SLIP_WITHOUT_BRAND) {
    return { kind: "slip", matched: names }
  }
  if (strong > 0 || matched.length >= UNSURE_FLOOR) return { kind: "unsure", matched: names }
  return { kind: "other", matched: names }
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

function pickReference(text: string, amount: number | null): string | null {
  const pattern = /\b\d{5,20}\b/g
  const amountDigits = amount === null ? "" : String(amount)
  let best: { value: string; score: number } | null = null

  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    const raw = m[0]
    if (raw.length < REF_MIN || raw.length > REF_MAX) continue
    // The amount is not the reference, however it was printed
    if (raw === amountDigits || raw === `${amountDigits}00`) continue

    const score = nearWord(text, m.index, REF_WORDS) * 3 + Math.min(1, raw.length / 12)
    if (!best || score > best.score) best = { value: raw, score }
  }
  return best?.value ?? null
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
  // 03AUG26, 03 AUG 2026, AUG 03 2026
  for (const m of text.matchAll(/\b(\d{1,2})\s*([A-Za-z]{3})\s*(\d{2,4})\b/g)) {
    const month = MONTHS.indexOf(m[2].toLowerCase())
    if (month >= 0) found.push(new Date(fullYear(m[3]), month, Number(m[1])))
  }
  for (const m of text.matchAll(/\b([A-Za-z]{3})\s*(\d{1,2})[,\s]+(\d{2,4})\b/g)) {
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
  return { amount, reference: pickReference(text, amount), date: pickDate(text, now) }
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

const KIND_RANK = { slip: 2, unsure: 1, other: 0 }

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
       none of the slip's wording is turned and read again before the verdict
       stands. A real slip stops at the first upright pass; only a page that
       is genuinely not the slip pays for all four. */
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
      reference: pickReference(best.text, amount),
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
 * The reading folded back into the slip report, once it exists. Only "none of
 * the slip's wording anywhere on the page" blocks — it is as close to a fact
 * as reading gets. Traces of the wording, or a reader that could not run at
 * all, warn and go through: stranding a manager over a faint print would cost
 * more than a slip the owner asks about.
 */
export function foldBank(report: SlipReport, fields: SlipFields): SlipReport {
  const finding = bankFinding(fields)
  if (finding === null) {
    return report.level === "ok"
      ? { ...report, headline: "The slip reads as a BDO transaction slip." }
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

function bankFinding(fields: SlipFields): SlipFinding | null {
  if (fields.failed) {
    return {
      id: "bank",
      level: "warn",
      title: "The wording could not be checked",
      detail:
        "The reader did not run on this device, so make sure the photo is the BDO deposit slip itself.",
    }
  }
  if (fields.bank.kind === "other") {
    return {
      id: "bank",
      level: "fail",
      title: "This does not read as a BDO deposit slip",
      detail:
        "None of the slip's printed wording was found in the photo. Photograph the BDO transaction slip itself — whole, filling the frame, in even light.",
    }
  }
  if (fields.bank.kind === "unsure") {
    return {
      id: "bank",
      level: "warn",
      title: "Hard to confirm this is the BDO slip",
      detail:
        "Only a little of the slip's printed wording could be read. Make sure this is the BDO transaction slip — a clearer photo helps the owner read it too.",
    }
  }
  return null
}
