/**
 * Lightweight fuzzy scorer. Returns a score when `query` is a subsequence of
 * `text`, or null when there is no match. Consecutive and prefix matches rank higher.
 */
export function fuzzyMatch(query: string, text: string): number | null {
  const q = query.toLowerCase().trim()
  const t = text.toLowerCase()
  if (!q) return 0
  let ti = 0
  let score = 0
  let streak = 0
  for (const ch of q) {
    const idx = t.indexOf(ch, ti)
    if (idx < 0) return null
    streak = idx === ti ? streak + 1 : 1
    score += 1 + streak * 0.4 + (idx === 0 ? 1.5 : 0)
    ti = idx + 1
  }
  return score - t.length * 0.01
}
