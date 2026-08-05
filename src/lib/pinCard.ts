/*
 * The recovery PIN, as something you can keep.
 *
 * The PIN is shown exactly once — the backend only ever stores a hash, so
 * there is no screen that can show it again later. That makes "save it now"
 * the whole point of the step, and a screenshot is not a promise: phones lose
 * photos, and a screenshot of a modal is easy to take and easy to miss.
 *
 * Both formats are built by hand rather than pulled from a library. A PNG is
 * a canvas the browser already has, and a one-page text PDF is a few hundred
 * bytes of literal syntax — neither is worth adding a dependency the whole
 * bundle would carry for one screen.
 */

const TITLE = "TWZ Manager"
const HEADING = "Recovery PIN"
const NOTE = "Needed to set a manager's password. Keep it somewhere private."
const WARNING = "This is the only time it is shown."

function stamp(when: Date): string {
  // ASCII only: the PDF writer below assumes one byte per character
  return when.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked on the next tick so the click has taken the URL first
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** A card the size of a phone screenshot, so it reads on the device it lands on */
export async function savePinAsImage(pin: string, when = new Date()): Promise<void> {
  const width = 1000
  const height = 640
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser cannot draw the PIN card.")

  ctx.fillStyle = "#faf9f6"
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = "#e3e1da"
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, width - 4, height - 4)

  ctx.fillStyle = "#8a887f"
  ctx.font = "500 26px ui-sans-serif, system-ui, sans-serif"
  ctx.fillText(TITLE.toUpperCase(), 64, 96)

  ctx.fillStyle = "#151613"
  ctx.font = "600 48px ui-sans-serif, system-ui, sans-serif"
  ctx.fillText(HEADING, 64, 168)

  /* The PIN itself, spaced so it cannot be misread at a glance — and measured
     before it is drawn, because a fixed font size at a fixed spacing is how
     the fourth digit ends up past the edge of the card */
  ctx.fillStyle = "#151613"
  const display = pin.split("").join(" ")
  let digitSize = 168
  do {
    ctx.font = `700 ${digitSize}px ui-monospace, 'Courier New', monospace`
    if (ctx.measureText(display).width <= width - 128) break
    digitSize -= 8
  } while (digitSize > 40)
  ctx.fillText(display, 64, 340)

  ctx.fillStyle = "#4a4a43"
  ctx.font = "400 26px ui-sans-serif, system-ui, sans-serif"
  ctx.fillText(NOTE, 64, 420)

  ctx.fillStyle = "#b3392f"
  ctx.font = "500 26px ui-sans-serif, system-ui, sans-serif"
  ctx.fillText(WARNING, 64, 466)

  ctx.fillStyle = "#8a887f"
  ctx.font = "400 22px ui-sans-serif, system-ui, sans-serif"
  ctx.fillText(`Set ${stamp(when)}`, 64, 552)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("The image could not be created.")
  download(blob, "twz-recovery-pin.png")
}

/**
 * Escapes the characters PDF string literals treat as syntax, and flattens
 * anything outside ASCII.
 *
 * The flattening is not cosmetic. The cross-reference table below is a list of
 * byte offsets computed from string length, while the Blob is encoded as UTF-8
 * — so a single multi-byte character silently shifts every offset after it and
 * the file stops opening. `toLocaleString` is the likely source: recent ICU
 * puts a narrow no-break space (U+202F) before AM/PM, which is invisible in the
 * editor and fatal here.
 */
function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/([\\()])/g, "\\$1")
}

/**
 * A single-page PDF, written out literally. Helvetica is one of the fourteen
 * fonts every PDF reader ships with, so nothing has to be embedded.
 */
export function savePinAsPdf(pin: string, when = new Date()): void {
  /* Character spacing (Tc) is PDF text STATE: it persists across BT/ET
     blocks until changed. Every line sets its own Tc explicitly, or the
     PIN's wide spacing leaks into all the body text after it. */
  const lines = [
    "BT",
    "/F1 18 Tf 64 748 Td 2 Tc (" + pdfText(TITLE.toUpperCase()) + ") Tj",
    "ET",
    "BT",
    "/F2 30 Tf 64 700 Td 0 Tc (" + pdfText(HEADING) + ") Tj",
    "ET",
    "BT",
    "/F3 84 Tf 64 596 Td 12 Tc (" + pdfText(pin) + ") Tj",
    "ET",
    "BT",
    "/F1 13 Tf 64 548 Td 0 Tc (" + pdfText(NOTE) + ") Tj",
    "ET",
    "BT",
    "/F2 13 Tf 64 524 Td 0 Tc (" + pdfText(WARNING) + ") Tj",
    "ET",
    "BT",
    "/F1 11 Tf 64 484 Td 0 Tc (" + pdfText("Set " + stamp(when)) + ") Tj",
    "ET",
  ].join("\n")

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]" +
      "/Resources<</Font<</F1 5 0 R/F2 6 0 R/F3 7 0 R>>>>/Contents 4 0 R>>",
    "<</Length " + lines.length + ">>\nstream\n" + lines + "\nendstream",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Courier-Bold>>",
  ]

  /* The cross-reference table is a list of byte offsets, so the file has to be
     assembled before it can be written — every object's position is counted
     as it goes in. Everything here is ASCII, so one character is one byte. */
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefAt = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += String(offset).padStart(10, "0") + " 00000 n \n"
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`

  download(new Blob([pdf], { type: "application/pdf" }), "twz-recovery-pin.pdf")
}
