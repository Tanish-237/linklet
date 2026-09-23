#!/usr/bin/env node
/**
 * Rebuilds the Material Symbols subset in index.html from the icons the
 * source actually uses.
 *
 * The site loads only the glyphs it needs (`icon_names=` on the Google Fonts
 * URL) — ~26 KB instead of the full font. A name missing from that list
 * renders as its raw text, so run this after adding a new icon:
 *
 *   npm run icons:sync
 *
 * It scans src/ for every quoted snake_case string plus the text inside
 * `material-icons` elements, keeps the ones that are real Material Symbols
 * names (list fetched from Google's repo), and rewrites the URL between the
 * ICONS markers in index.html. Extra names are harmless — they only add a few
 * bytes — so scanning every string literal errs on the safe side.
 * (src/__tests__/iconSubset.test.js checks the list offline in CI.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CODEPOINTS_URL =
  "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints";

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
  });

const res = await fetch(CODEPOINTS_URL);
if (!res.ok) throw new Error(`Could not fetch the Material Symbols name list (${res.status})`);
const valid = new Set((await res.text()).split("\n").map((l) => l.split(" ")[0]).filter(Boolean));

const used = new Set();
for (const file of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/["'`]([a-z][a-z0-9_]{1,40})["'`]/g)) used.add(m[1]);
  for (const m of src.matchAll(/material-icons[^>]*>\s*([a-z0-9_]+)\s*</g)) used.add(m[1]);
}

const names = [...used].filter((n) => valid.has(n)).sort();
const url =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0" +
  `&icon_names=${names.join(",")}&display=block`;

const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const block = /(<!-- ICONS:START[^>]*-->\s*)<link[^>]*>(\s*<!-- ICONS:END -->)/;
if (!block.test(html)) throw new Error("ICONS:START / ICONS:END markers not found in index.html");
fs.writeFileSync(htmlPath, html.replace(block, `$1<link href="${url}" rel="stylesheet">$2`));
console.log(`index.html: ${names.length} Material Symbols icons`);
