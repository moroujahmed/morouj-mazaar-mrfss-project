#!/usr/bin/env node
/**
 * Forbidden palette combinations (DESIGN_SYSTEM_V2.md §2, ACCESSIBILITY.md §2.1).
 *
 * Scans application TSX/TS class strings for:
 *   - white text on an orange background in the same class list
 *   - orange-500 used as text on a light surface
 *   - raw #F28C28 paired with white text
 *
 * Run with: node scripts/check-tokens.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = "src";
const EXTENSIONS = new Set([".ts", ".tsx"]);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collect(path)));
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      files.push(path);
    }
  }

  return files;
}

const offenders = [];

for (const file of await collect(ROOT)) {
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const whiteText = /\btext-white\b/.test(line);
    const orangeBackground =
      /\bbg-orange-(?:500|600)\b/.test(line) || /#F28C28/i.test(line);
    const orangeBodyText = /\btext-orange-500\b/.test(line);
    const lightSurface =
      /\bbg-white\b(?!\/)/.test(line) ||
      /\bbg-surface\b/.test(line) ||
      /\bbg-green-50\b/.test(line) ||
      /\bbg-surface-inset\b/.test(line) ||
      /#FFFFFF/i.test(line) ||
      /#F2F7F5/i.test(line) ||
      /#F2F4F3/i.test(line);

    if (whiteText && orangeBackground) {
      offenders.push({
        file,
        line: index + 1,
        reason: "white text on an orange surface",
      });
    }

    if (orangeBodyText && lightSurface) {
      offenders.push({
        file,
        line: index + 1,
        reason: "orange-500 used as body text on a light surface",
      });
    }
  });
}

if (offenders.length > 0) {
  console.error("Forbidden palette combinations found:");
  for (const offender of offenders) {
    console.error(
      `  ${relative(process.cwd(), offender.file)}:${offender.line} — ${offender.reason}`,
    );
  }
  process.exit(1);
}

console.log("Token check passed: no forbidden palette combinations.");
