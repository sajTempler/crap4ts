export type ScoringUnit = {
  name: string
  file: string
  startLine: number
  endLine: number
  complexity: number
}

export type ParserAdapter = {
  scoringUnits(filename: string, sourceText: string): ScoringUnit[]
}
