// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// The Content-Security-Policy (vercel.json) allows inline scripts only by their
// SHA-256 hash. Editing an inline <script> in index.html changes its hash, and
// without this test the live site would silently stop running it (theme flash,
// iOS zoom fix). If this fails, copy the printed hash into vercel.json.
const root = fileURLToPath(new URL("../../", import.meta.url));
const html = readFileSync(`${root}index.html`, "utf8");
const config = JSON.parse(readFileSync(`${root}vercel.json`, "utf8"));

const csp = config.headers
  .flatMap((h) => h.headers)
  .find((h) => h.key === "Content-Security-Policy").value;
const directive = (name) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) || "";

const inlineScripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attrs]) => !attrs.includes("src=") && !/type="application\/(ld\+)?json"/.test(attrs))
  .map(([, , body]) => body);

describe("Content-Security-Policy", () => {
  it("allows every inline script in index.html by hash", () => {
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const body of inlineScripts) {
      const hash = `'sha256-${createHash("sha256").update(body).digest("base64")}'`;
      console.log("[TEST] inline script hash", hash);
      expect(directive("script-src")).toContain(hash);
    }
  });

  it("never allows arbitrary inline or eval'd script", () => {
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
    expect(directive("script-src")).not.toContain("'unsafe-eval'");
  });

  it("blocks framing, plugins and base-tag hijacking", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
  });

  it("lets the app reach its API over HTTPS and WebSocket", () => {
    expect(directive("connect-src")).toContain("https://api.linklet.org");
    expect(directive("connect-src")).toContain("wss://api.linklet.org");
    expect(directive("connect-src")).toContain("https://api.cloudinary.com");
  });
});
