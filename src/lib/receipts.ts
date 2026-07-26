/*
 * Receipt attachment model, shared by the log form and the edit dialog.
 * An entry with a file is a photo held this session (previewable); an entry
 * with file: null is one already on the server that we cannot preview yet,
 * kept as a placeholder so it can still be counted and removed.
 */
export type ReceiptEntry = { id: string; file: File | null }

let seq = 0
export function newReceiptEntry(file: File): ReceiptEntry {
  seq += 1
  return { id: `rc-${Date.now().toString(36)}-${seq}`, file }
}

export function onFileEntries(count: number): ReceiptEntry[] {
  return Array.from({ length: count }, (_, i) => ({ id: `on-file-${i}`, file: null }))
}
