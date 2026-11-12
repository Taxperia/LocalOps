/**
 * Parses a single CSV line honoring double-quoted fields with "" escaping
 * (the format tasklist /fo csv emits).
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cur += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      out.push(cur)
      cur = ''
      i++
      continue
    }
    cur += ch
    i++
  }
  out.push(cur)
  return out
}
