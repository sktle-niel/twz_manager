/*
 * Receipt attachment model, shared by the log form and the edit dialog.
 * An entry with a file is a photo picked this session; an entry with a url is
 * one the backend already stores, previewable from there. Removing either kind
 * is the same gesture — the difference only matters when the edit is saved,
 * where kept urls and new files travel separately.
 */
export type ReceiptEntry = { id: string; file: File | null; url: string | null }

let seq = 0
export function newReceiptEntry(file: File): ReceiptEntry {
  seq += 1
  return { id: `rc-${Date.now().toString(36)}-${seq}`, file, url: null }
}

export function storedEntries(urls: string[]): ReceiptEntry[] {
  return urls.map((url, i) => ({ id: `on-file-${i}`, file: null, url }))
}
