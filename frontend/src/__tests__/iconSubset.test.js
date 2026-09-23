import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// index.html loads only the Material Symbols glyphs the site uses. An icon
// missing from that list renders as its raw name ("bookmark") instead of the
// glyph — so fail here and point at the fix: `npm run icons:sync`.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
    return /\.jsx?$/.test(e.name) ? [p] : [];
  });

const loaded = new Set(
  (fs.readFileSync(path.join(root, "index.html"), "utf8").match(/icon_names=([a-z0-9_,]+)/)?.[1] || "").split(",")
);

// Names that are unambiguously icons: text of an icon element, an `icon`
// prop/field, <Icon name="…">, and string branches inside an icon element.
const usedIcons = () => {
  const found = new Map();
  const add = (name, file) => found.set(name, found.get(name) || path.relative(root, file));
  for (const file of walk(path.join(root, "src"))) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/material-icons[^>]*>\s*([a-z0-9_]+)\s*</g)) add(m[1], file);
    for (const m of src.matchAll(/\bicon\s*[:=]\s*["']([a-z0-9_]+)["']/g)) add(m[1], file);
    for (const m of src.matchAll(/<Icon[^>]*\bname=["']([a-z0-9_]+)["']/g)) add(m[1], file);
    for (const m of src.matchAll(/material-icons[^>]*>\s*\{([^{}]*)\}\s*</g)) {
      // only the branch results (`? "a" : "b"`), not values in the condition
      for (const lit of m[1].matchAll(/[?:]\s*["']([a-z][a-z0-9_]+)["']/g)) add(lit[1], file);
    }
  }
  return found;
};

describe("Material Symbols subset", () => {
  it("index.html loads a subset", () => {
    expect(loaded.size).toBeGreaterThan(50);
  });

  it("includes every icon the source uses (run `npm run icons:sync` if this fails)", () => {
    const missing = [...usedIcons()].filter(([name]) => !loaded.has(name)).map(([n, f]) => `${n} (${f})`);
    expect(missing).toEqual([]);
  });
});
