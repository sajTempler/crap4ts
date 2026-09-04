/**
 * PROTOTYPE — throwaway.
 * Question: is ParserAdapter.scoringUnits(filename, sourceText) → ScoringUnit[]
 * the right seam? CC lives inside each adapter; scoring never sees oxc nodes.
 *
 * Run: pnpm start
 */

import { readFileSync } from "node:fs";
import { oxcParser } from "./oxc-adapter.mjs";

const filename = "fixture.ts";
const sourceText = readFileSync(new URL("./fixture.ts", import.meta.url), "utf8");

const units = oxcParser.scoringUnits(filename, sourceText);

console.log("Parser adapter prototype");
console.log("Interface: scoringUnits(filename, sourceText) → ScoringUnit[]");
console.log("Adapter: oxc. 7.1 hole is the ParserAdapter type, not a throwing module.");
console.log("");
console.table(units);
