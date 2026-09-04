# crap4ts

Two sibling tools in one repo: CRAP for TypeScript production code, SCRAP for Vitest tests. They share a report style and nothing else of their scores.

## Language

**CRAP**:
The family change-risk score of a scoring unit: `CC² × (1 − coverage)³ + CC`.
_Avoid_: blended score, quality score, risk (alone)

**CC**:
1 plus the scoring unit's runtime decision points: `if`, loops, every `switch` case including `default`, `catch`, `&&`, `||`, ternary.
_Avoid_: ESLint complexity, McCabe (as the visitor list)

**SCRAP**:
The Speclj-originated structural quality score of a test example and the file-level advice derived from it. In this repo it applies only to Vitest.
_Avoid_: CRAP-for-tests, test CRAP

**Scoring unit**:
A body-bearing TypeScript function-like that is not nested in another function. Nested arrows and callbacks are not units; their complexity folds into the parent.
_Avoid_: function (alone), method (alone), symbol, callback (as a row)

**Coverage**:
The fraction of LCOV `DA` lines in a scoring unit's source span that tests executed. A missing file is unknown (`N/A`), not 0%. Not `FN`/`FNDA` function-hit and not a name match.
_Avoid_: branch coverage, function coverage (Istanbul's named metric)

**Parser adapter**:
The seam in crap4ts that turns source text into scoring units, CC included. oxc-parser is the first adapter; a TypeScript 7.1 adapter may replace it. Scoring never sees parser types. scrap4ts does not share this seam.
_Avoid_: parser (alone), oxc (as the product concept), kernel, shared parser

**Report**:
The human-readable stdout for a run: crap4ts prints the fixed-width CRAP table; scrap4ts prints the guidance text. Scores never fail the process. scrap4ts `--json` is a different emission, not a Report.
_Avoid_: dashboard, quality gate, JSON

**Path fragment**:
A substring of a discovered file path. When any are given, only matching files are analyzed; several fragments are OR.
_Avoid_: module filter, glob (as the user-facing filter), --changed

**Baseline**:
A scrap4ts JSON document saved under `target/scrap/` for a later `--compare`.
_Avoid_: snapshot, golden file, fixture

**Package**:
One installable unit with one binary. This repo has two: crap4ts and scrap4ts. The unpublished repo root is not a third package.
_Avoid_: tool, app, workspace (for a single package)

**Example**:
One Vitest `it` or `test` that SCRAP scores. `test.for` / `test.each` is one table-driven example, not N siblings.
_Avoid_: spec, spec example, test case

**Remediation**:
SCRAP's file-level move: `STABLE`, `LOCAL`, or `SPLIT`.
_Avoid_: refactor mode, pressure mode

**Actionability**:
SCRAP's AI gate: `LEAVE_ALONE`, `AUTO_TABLE_DRIVE`, `AUTO_REFACTOR`, `MANUAL_SPLIT`, or `REVIEW_FIRST`. `AUTO_TABLE_DRIVE` means `test.for`.
_Avoid_: recommendation (for this gate; how-lines are separate)
