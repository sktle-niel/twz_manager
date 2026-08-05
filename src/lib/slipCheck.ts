/*
 * Is this deposit slip photo usable as evidence?
 *
 * "Valid" is not one judgement, so this does not pretend to make one. It runs
 * named checks and reports each, because "invalid" is useless to a manager who
 * cannot see which part failed.
 *
 * What it deliberately does NOT do is read the figures off the slip. That is
 * OCR — a backend or a heavy in-browser model — and guessing at it would be
 * worse than not doing it: a wrong reading that silently passes is exactly the
 * failure this whole app exists to prevent. The manager types the amount and
 * the app checks that figure against the expected total instead.
 *
 * Two levels, kept apart on purpose:
 *
 * - `fail` is objective. The file will not decode, the image is too small to
 *   hold readable text, or the exact same photo was already filed against
 *   another deposit. These block the deposit.
 * - `warn` is a heuristic — focus, contrast, whether the frame looks like paper
 *   at all, how old the file is. These are wrong often enough that refusing an
 *   upload over one would strand a manager at 9pm with a readable slip, so they
 *   are stated plainly and let through.
 */
import { shortDate } from "./format"

export type SlipLevel = "ok" | "warn" | "fail"

export type SlipFinding = {
  id: "file" | "size" | "duplicate" | "document" | "focus" | "age"
  level: Exclude<SlipLevel, "ok">
  title: string
  detail: string
}

export type SlipReport = {
  level: SlipLevel
  headline: string
  findings: SlipFinding[]
  /* Recorded when the deposit is filed, so the next slip can be checked
     against it. Empty when the frame never decoded. */
  sha: string
  phash: string
}

/* A slip already filed. The label goes into the message so a manager knows
   which deposit the photo was used for. */
export type KnownSlip = { sha: string; phash: string; label: string }

/* Below this a phone photo cannot hold legible slip text at any focus */
const MIN_EDGE = 480
/* Centre crop for the focus measure, sampled at native scale */
const FOCUS_CROP = 640

/* Variance of the Laplacian: the usual focus measure. Sharp slip text scores
   far above these — a synthetic sharp slip lands near 4500, the same slip
   blurred near 7. Real phone noise inflates it, so the floors sit low. */
const BLURRY_UNDER = 15
const SOFT_UNDER = 60
/* Luminance spread; a flat frame is a desk or a blown-out highlight */
const FLAT_UNDER = 12
/* A slip photo should be mostly paper: bright and close to colourless */
const PAPER_LUMA = 170
const PAPER_SATURATION = 44
/* Frame used to judge composition; large enough for row structure to show */
const DOC_VIEW = 128

/* Anything this dark reads as print rather than shadow on paper */
const INK_LUMA = 110

/*
 * Thresholds for "is there a document in this frame at all", calibrated
 * against generated frames rather than guessed.
 *
 * An earlier attempt used Otsu separability, on the theory that print is
 * strongly bimodal and photographs are not. Measuring it killed the idea: a
 * landscape scored 0.90 and a portrait 0.69 against a slip's 1.00, because
 * Otsu always finds *some* best split. It is not in here.
 *
 * What survives measurement is coarse on purpose. These reject frames with no
 * paper, no print, or no line structure. They cannot tell a bank slip from any
 * other printed page — that needs to read the words, which is OCR.
 */
const DOC = {
  /* Paper anywhere in the frame at all, before looking at where */
  coverageFloor: 0.05,
  /* Inside the located sheet, how much of it still reads as paper. A region
     that is only half paper was not a sheet, it was a bright patch. */
  fillFloor: 0.42,
  /* Print coverage inside the sheet. None is a blank surface; over half is not
     print but shadow or a dark subject. */
  inkFloor: 0.004,
  inkCeiling: 0.5,
  /* Row-to-row swing in print coverage across the sheet. Text sits in bands
     with gaps between, so coverage lurches; a photograph's drifts. */
  bandingFloor: 0.25,
  /* Above the floors but still a poor photo of one */
  fillWeak: 0.6,
  bandingWeak: 0.45,
}
/* Differing bits between two perceptual hashes before they read as the same
   picture. 64 bits total, so this is a tight match. */
const PHASH_NEAR = 8
/* A slip photographed well before the deposit is worth a second look */
const STALE_DAYS = 7

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("decode failed"))
    }
    img.src = url
  })
}

async function sha256(file: File): Promise<string> {
  // Unavailable outside a secure context; the perceptual hash still covers reuse
  if (!globalThis.crypto?.subtle) return ""
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
  } catch {
    return ""
  }
}

function grayscale(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(data.length / 4)
  for (let i = 0; i < out.length; i++) {
    const p = i * 4
    out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return out
}

/* Row-gradient (difference) hash: each bit says whether a cell is brighter
   than the one to its right, which survives recompression and resizing. */
function dHash(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas")
  canvas.width = 9
  canvas.height = 8
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return ""
  ctx.drawImage(img, 0, 0, 9, 8)
  const gray = grayscale(ctx.getImageData(0, 0, 9, 8).data)

  let bits = ""
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += gray[y * 9 + x] > gray[y * 9 + x + 1] ? "1" : "0"
    }
  }
  return bits
}

export type DocMetrics = {
  /* Share of the whole frame that is bright and near-colourless */
  coverage: number
  /* Share of the located sheet that is still paper */
  fill: number
  /* Print coverage inside the sheet */
  ink: number
  /* How much print coverage swings from one row of the sheet to the next */
  banding: number
}

/* Range covering the bulk of a projection, ignoring stray bright pixels */
function span(projection: Float32Array): [number, number] {
  let peak = 0
  for (const v of projection) peak = Math.max(peak, v)
  if (peak === 0) return [0, projection.length - 1]
  const floor = peak * 0.15
  let lo = 0
  let hi = projection.length - 1
  while (lo < hi && projection[lo] < floor) lo++
  while (hi > lo && projection[hi] < floor) hi--
  return [lo, hi]
}

/*
 * Kept pure — plain pixels in, numbers out, no canvas — so the thresholds above
 * can be calibrated against generated frames instead of guessed at.
 *
 * It locates the sheet before measuring it. Measuring the whole frame rejected
 * real slips: a slip on a dark table came back at 75% "ink", because the table
 * is dark, and a small slip on the same table at 90%. Both would have blocked a
 * manager from filing a perfectly good deposit.
 *
 * Ink is a fixed luma, not an adaptive split. An adaptive one always divides
 * the frame roughly in half, so every photograph returned ~50% ink and the
 * measure said nothing at all.
 */
export function documentMetrics(rgba: Uint8ClampedArray, size: number): DocMetrics {
  const total = size * size
  const paperAt = new Uint8Array(total)
  const rows = new Float32Array(size)
  const cols = new Float32Array(size)
  let coverage = 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const p = i * 4
      const r = rgba[p]
      const g = rgba[p + 1]
      const b = rgba[p + 2]
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      if (luma > PAPER_LUMA && Math.max(r, g, b) - Math.min(r, g, b) < PAPER_SATURATION) {
        paperAt[i] = 1
        rows[y]++
        cols[x]++
        coverage++
      }
    }
  }

  if (coverage === 0) return { coverage: 0, fill: 0, ink: 0, banding: 0 }

  const [y0, y1] = span(rows)
  const [x0, x1] = span(cols)
  const sheetW = x1 - x0 + 1
  const sheetH = y1 - y0 + 1
  const sheetArea = sheetW * sheetH

  let fill = 0
  let ink = 0
  const rowInk = new Float32Array(sheetH)

  for (let y = y0; y <= y1; y++) {
    let dark = 0
    for (let x = x0; x <= x1; x++) {
      const i = y * size + x
      if (paperAt[i]) fill++
      const p = i * 4
      const luma = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
      if (luma < INK_LUMA) dark++
    }
    rowInk[y - y0] = dark / sheetW
    ink += dark
  }

  let rowMean = 0
  for (let y = 0; y < sheetH; y++) rowMean += rowInk[y]
  rowMean /= sheetH
  let rowSpread = 0
  for (let y = 0; y < sheetH; y++) rowSpread += (rowInk[y] - rowMean) ** 2
  const banding = rowMean > 0 ? Math.sqrt(rowSpread / sheetH) / rowMean : 0

  return {
    coverage: coverage / total,
    fill: fill / sheetArea,
    ink: ink / sheetArea,
    banding,
  }
}

export type DocVerdict = "document" | "poor" | "not-a-document"

/*
 * Any one of the floors failing is enough to reject: each describes a frame
 * that cannot contain a readable slip at all, rather than one that merely
 * photographs it badly.
 */
export function documentVerdict(m: DocMetrics): DocVerdict {
  if (m.coverage < DOC.coverageFloor) return "not-a-document"
  if (m.fill < DOC.fillFloor) return "not-a-document"
  if (m.ink < DOC.inkFloor || m.ink > DOC.inkCeiling) return "not-a-document"
  if (m.banding < DOC.bandingFloor) return "not-a-document"
  if (m.fill < DOC.fillWeak || m.banding < DOC.bandingWeak) return "poor"
  return "document"
}

function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return Number.MAX_SAFE_INTEGER
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
  return d
}

function fail(id: SlipFinding["id"], title: string, detail: string): SlipReport {
  return {
    level: "fail",
    headline: title,
    findings: [{ id, level: "fail", title, detail }],
    sha: "",
    phash: "",
  }
}

export async function inspectSlip(
  file: File,
  known: KnownSlip[],
  now: Date,
): Promise<SlipReport> {
  if (!file.type.startsWith("image/")) {
    return fail("file", "That file is not an image", "Attach a photo of the deposit slip.")
  }

  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    return fail(
      "file",
      "The photo could not be opened",
      "The file may be damaged. Take another one.",
    )
  }

  const w = img.naturalWidth
  const h = img.naturalHeight
  const size = `${w}×${h}`

  if (Math.min(w, h) < MIN_EDGE) {
    return fail(
      "size",
      `Too small to read (${size})`,
      `A slip needs at least ${MIN_EDGE} pixels on its short side. Take the photo again rather than cropping one down.`,
    )
  }

  const sha = await sha256(file)
  const phash = dHash(img)
  const findings: SlipFinding[] = []

  // Reuse first: nothing else about the photo matters if it is already on file
  const same = sha ? known.find((k) => k.sha && k.sha === sha) : undefined
  if (same) {
    return {
      level: "fail",
      headline: "This exact photo was already used",
      findings: [
        {
          id: "duplicate",
          level: "fail",
          title: "This exact photo was already used",
          detail: `It was filed with deposit ${same.label}. Photograph the new slip.`,
        },
      ],
      sha,
      phash,
    }
  }
  const near = known.find((k) => hamming(k.phash, phash) <= PHASH_NEAR)
  if (near) {
    findings.push({
      id: "duplicate",
      level: "warn",
      title: "This looks like a slip already filed",
      detail: `Nearly identical to the photo used for deposit ${near.label}. Check it is not the same slip.`,
    })
  }

  const viewCanvas = document.createElement("canvas")
  viewCanvas.width = DOC_VIEW
  viewCanvas.height = DOC_VIEW
  const viewCtx = viewCanvas.getContext("2d", { willReadFrequently: true })
  if (viewCtx) {
    viewCtx.drawImage(img, 0, 0, DOC_VIEW, DOC_VIEW)
    const metrics = documentMetrics(viewCtx.getImageData(0, 0, DOC_VIEW, DOC_VIEW).data, DOC_VIEW)
    const verdict = documentVerdict(metrics)

    if (verdict === "not-a-document") {
      /* Nothing else is worth saying about a frame with no document in it,
         and the focus of a photo of a wall is beside the point */
      findings.push({
        id: "document",
        level: "fail",
        title: "This is not a photo of a deposit slip",
        detail:
          metrics.ink < 0.004
            ? "No printing found in the frame. Photograph the slip itself, filling the frame on a plain surface."
            : "No sheet of paper with printed lines found. Photograph the slip itself, filling the frame on a plain surface.",
      })
      return { level: "fail", headline: "This is not a photo of a deposit slip", findings, sha, phash }
    }

    if (verdict === "poor") {
      findings.push({
        id: "document",
        level: "warn",
        title: "The slip is hard to make out",
        detail:
          "Little of the frame is the slip, or its lines are faint. Move closer, on a plain surface, in even light.",
      })
    }
  }

  const crop = Math.min(FOCUS_CROP, w, h)
  const focusCanvas = document.createElement("canvas")
  focusCanvas.width = crop
  focusCanvas.height = crop
  const focusCtx = focusCanvas.getContext("2d", { willReadFrequently: true })
  if (focusCtx) {
    /* Centre crop at native scale rather than a scaled-down whole frame:
       downscaling smooths away exactly the detail this measures, so a blurry
       photo would come back looking sharp. */
    focusCtx.drawImage(img, (w - crop) / 2, (h - crop) / 2, crop, crop, 0, 0, crop, crop)
    const gray = grayscale(focusCtx.getImageData(0, 0, crop, crop).data)

    let sum = 0
    for (let i = 0; i < gray.length; i++) sum += gray[i]
    const mean = sum / gray.length
    let spread = 0
    for (let i = 0; i < gray.length; i++) spread += (gray[i] - mean) ** 2
    const contrast = Math.sqrt(spread / gray.length)

    let lapSum = 0
    let lapSquares = 0
    let count = 0
    for (let y = 1; y < crop - 1; y++) {
      for (let x = 1; x < crop - 1; x++) {
        const i = y * crop + x
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - crop] - gray[i + crop]
        lapSum += lap
        lapSquares += lap * lap
        count++
      }
    }
    const lapMean = lapSum / count
    const sharpness = lapSquares / count - lapMean * lapMean

    if (contrast < FLAT_UNDER) {
      findings.push({
        id: "focus",
        level: "warn",
        title: "The photo looks washed out",
        detail: "Almost no light or shade in the frame. Avoid glare and shadow across the slip.",
      })
    } else if (sharpness < BLURRY_UNDER) {
      findings.push({
        id: "focus",
        level: "warn",
        title: "The photo looks blurry",
        detail: "The owner may not be able to read the figures. Hold steady and take it again.",
      })
    } else if (sharpness < SOFT_UNDER) {
      findings.push({
        id: "focus",
        level: "warn",
        title: "The photo is a little soft",
        detail: "Readable, but a sharper one is worth the second try.",
      })
    }
  }

  const stamped = file.lastModified
  if (stamped > 0 && stamped < now.getTime()) {
    const days = Math.floor((now.getTime() - stamped) / 86_400_000)
    if (days > STALE_DAYS) {
      findings.push({
        id: "age",
        level: "warn",
        title: `This photo is ${days} days old`,
        detail: `Saved ${shortDate(new Date(stamped))}. Make sure it is the slip for this deposit.`,
      })
    }
  }

  const worst: SlipLevel = findings.some((f) => f.level === "fail")
    ? "fail"
    : findings.length > 0
      ? "warn"
      : "ok"

  return {
    level: worst,
    headline:
      worst === "ok" ? `The slip looks valid: ${size}, in focus.` : "Check the photo before recording",
    findings,
    sha,
    phash,
  }
}
