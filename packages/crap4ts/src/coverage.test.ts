import { expect, test } from "vitest"
import { coverageForRange, parseLcov } from "./coverage.js"

const sample = parseLcov(`TN:
SF:src/foo.ts
DA:3,1
DA:4,0
DA:8,5
end_of_record
TN:
SF:packages/app/src/bar.ts
DA:1,1
end_of_record
`)

test.for([
  {
    name: "parses DA lines and ignores FN/FNDA",
    lcov: parseLcov(`TN:
SF:src/foo.ts
FN:3,foo
FNDA:0,foo
DA:3,1
DA:4,0
end_of_record
`),
    file: "src/foo.ts",
    start: 3,
    end: 4,
    expected: 50,
  },
  {
    name: "missing SF is unknown coverage, not 0%",
    lcov: sample,
    file: "src/missing.ts",
    start: 1,
    end: 10,
    expected: undefined,
  },
  {
    name: "file present with no DA in range is 0%",
    lcov: sample,
    file: "src/foo.ts",
    start: 100,
    end: 110,
    expected: 0,
  },
  {
    name: "suffix-matches monorepo SF paths",
    lcov: sample,
    file: "src/bar.ts",
    start: 1,
    end: 1,
    expected: 100,
  },
  {
    name: "normalizes backslashes and file: prefixes",
    lcov: parseLcov(`SF:file:src\\\\foo.ts
DA:1,1
end_of_record
`),
    file: "src/foo.ts",
    start: 1,
    end: 1,
    expected: 100,
  },
  {
    name: "load of a missing file is unknown for every unit",
    lcov: undefined,
    file: "src/foo.ts",
    start: 1,
    end: 10,
    expected: undefined,
  },
])("$name", ({ lcov, file, start, end, expected }) => {
  expect(coverageForRange(lcov, file, start, end)).toEqual(expected)
})
