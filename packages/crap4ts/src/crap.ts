export type CrapEntry = {
  name: string
  file: string
  complexity: number
  coverage: number | undefined
  crap: number | undefined
}

export function score(complexity: number, coveragePct: number | undefined): number | undefined {
  if (coveragePct === undefined) return undefined
  const cc = complexity
  const uncov = 1 - coveragePct / 100
  return cc * cc * uncov * uncov * uncov + cc
}

export function sortByCrap(entries: CrapEntry[]): CrapEntry[] {
  return [...entries].sort((a, b) => {
    if (a.crap === undefined && b.crap === undefined) return a.name.localeCompare(b.name)
    if (a.crap === undefined) return 1
    if (b.crap === undefined) return -1
    return b.crap - a.crap
  })
}

function formatCoverage(coverage: number | undefined): string {
  if (coverage === undefined) return "  N/A "
  return `${coverage.toFixed(1).padStart(5)}%`
}

function formatScore(value: number | undefined): string {
  if (value === undefined) return "     N/A"
  return value.toFixed(1).padStart(8)
}

export function formatReport(entries: CrapEntry[]): string {
  const header = pad("Function", 30) + " " + pad("File", 35) + " " + pad("CC", 4, true) + " " + pad("Cov%", 7, true) + " " + pad("CRAP", 8, true)
  const sep = "-".repeat(header.length)
  const lines = ["CRAP Report", "===========", header, sep]
  for (const entry of entries) {
    lines.push(
      pad(entry.name, 30) +
        " " +
        pad(entry.file, 35) +
        " " +
        String(entry.complexity).padStart(4) +
        " " +
        formatCoverage(entry.coverage).padStart(7) +
        " " +
        formatScore(entry.crap),
    )
  }
  lines.push("")
  return lines.join("\n")
}

function pad(value: string, width: number, right = false): string {
  if (right) return value.padStart(width)
  return value.padEnd(width)
}
