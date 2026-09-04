#!/usr/bin/env node
import process from "node:process"
import { run } from "./cli.js"

const result = await run(process.argv.slice(2))
process.stdout.write(result.stdout)
process.exitCode = result.exitCode
