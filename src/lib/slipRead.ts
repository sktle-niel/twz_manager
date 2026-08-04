/*
 * Reads the machine-printed validation off a deposit slip and offers the
 * figures back to the form.
 *
 * The branches' slips are filled in by hand and then validated by the bank's
 * printer, so this reads the *printed* part on purpose. That is the better
 * half to trust anyway: it is what the bank actually processed, not what the
 * manager wrote down. Handwriting is beyond Tesseract and is not attempted.
 *
 * Everything here is a proposal, never an answer. The figures land in the form
 * for the manager to check, the raw text is kept so a wrong read can be seen
 * rather than guessed at, and the expected total is deliberately NOT used to
 * choose between candidates — letting it pick the reading that happens to
 * match would quietly bury the discrepancies this app exists to surface.
 */
import { loadImage } from "./slipCheck"

export type SlipFields = {
  amount: number | null
  reference: string | null
  date: Date | null
  /* Tesseract's own 0-100 score for the page */
  confidence: number
  /* Kept so a bad parse can be diagnosed */
  text: string
  failed: boolean
}

const EMPTY: SlipFields = {
  amount: null,
  reference: null,
  date: null,
  confidence: 0,
  text: "",
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
    const { data } = await worker.recognize(canvas)
    const text = data.text ?? ""
    const amount = pickAmount(text)
    return {
      amount,
      reference: pickReference(text, amount),
      date: pickDate(text, now),
      confidence: Math.round(data.confidence ?? 0),
      text,
      failed: false,
    }
  } catch {
    return EMPTY
  }
}
