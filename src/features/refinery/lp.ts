// A small linear programme solver: the tool refinery planners use to choose
// blends and crude slates. Maximises c·x subject to A·x ≤ b and x ≥ 0, with
// every b ≥ 0 so that x = 0 is a starting point. Dense tableau simplex with
// Bland's rule, which never cycles. Fine for the dozen or so variables a
// blend has; not meant for big models.

export interface LpResult {
  x: number[]
  value: number
  /** False when the objective can grow without limit. */
  bounded: boolean
}

const EPS = 1e-9

export function maximise(c: number[], a: number[][], b: number[]): LpResult {
  const n = c.length
  const m = b.length
  if (b.some((v) => v < -EPS)) throw new Error('maximise needs b ≥ 0')
  // Tableau: m constraint rows with slack columns, then the objective row.
  const t = a.map((row, i) => [...row, ...Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)), Math.max(0, b[i])])
  t.push([...c.map((v) => -v), ...Array(m).fill(0), 0])
  const basis = Array.from({ length: m }, (_, i) => n + i)
  const width = n + m

  for (let iter = 0; iter < 500; iter++) {
    // Entering column: the lowest index with a negative reduced cost (Bland).
    let col = -1
    for (let j = 0; j < width; j++)
      if (t[m][j] < -EPS) {
        col = j
        break
      }
    if (col < 0) break
    // Leaving row: the minimum ratio, ties to the lowest basis index.
    let row = -1
    let best = Infinity
    for (let i = 0; i < m; i++) {
      if (t[i][col] <= EPS) continue
      const ratio = t[i][width] / t[i][col]
      if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[row])) {
        best = ratio
        row = i
      }
    }
    if (row < 0) return { x: Array(n).fill(0), value: Infinity, bounded: false }
    const pivot = t[row][col]
    t[row] = t[row].map((v) => v / pivot)
    for (let i = 0; i <= m; i++) {
      if (i === row || Math.abs(t[i][col]) <= EPS) continue
      const f = t[i][col]
      t[i] = t[i].map((v, j) => v - f * t[row][j])
    }
    basis[row] = col
  }

  const x = Array(n).fill(0)
  basis.forEach((j, i) => {
    if (j < n) x[j] = t[i][width]
  })
  return { x, value: t[m][width], bounded: true }
}
