#!/usr/bin/env node
/**
 * Structural validator for the canonical Stitch design package.
 * Checks every screen in screens/ for the package rules in README.md.
 * Usage: node docs/stitch-design/validate.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const screensDir = path.join(__dirname, "screens");
const files = fs
  .readdirSync(screensDir)
  .filter((file) => file.endsWith(".html"))
  .sort();

const issues = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(screensDir, file), "utf8");
  const add = (message) => issues.push(`${file}: ${message}`);

  if (!html.includes('class="skip-link"')) add("missing skip link");

  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (h1Count !== 1) add(`expected one h1, found ${h1Count}`);

  if (!html.includes('id="main"')) add('missing <main id="main">');
  if (!html.includes("assets/tailwind.css")) add("missing tailwind.css link");
  if (!html.includes("assets/app.css")) add("missing app.css link");
  if (/cdn\.tailwindcss\.com/.test(html)) add("uses the Tailwind CDN");
  if (html.includes('href="#"')) add('contains a dead href="#" link');
}

console.log(`${files.length} files, ${issues.length} issues`);
if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}
