import { describe, it, expect } from "vitest";
import { mergeIntoShell } from "../mergeHtml.mjs";

const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Linklet</title>
    <meta
      name="description"
      content="Default fallback description spanning
      multiple lines."
    />
    <meta property="og:title" content="Linklet — Your campus, organized" />
    <meta property="og:image" content="https://linklet.org/linklet-logo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#0a0a0a" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`;

describe("mergeIntoShell", () => {
  it("replaces the shell's default title with the page's Helmet title, without leaving a duplicate", () => {
    console.log("[TEST] mergeIntoShell › replaces <title> exactly once");
    const merged = mergeIntoShell(SHELL, {
      titleTag: '<title data-rh="true">About Linklet</title>',
      metaTags: "",
      bodyHtml: "<div>about content</div>",
    });

    expect(merged.match(/<title/g)).toHaveLength(1);
    expect(merged).toContain("About Linklet");
    expect(merged).not.toContain(">Linklet<");
  });

  it("removes the shell's default description/og/twitter meta tags — even when their attributes span multiple lines — so the page's own set doesn't end up duplicated", () => {
    console.log("[TEST] mergeIntoShell › strips multi-line default meta before inserting the page's own");
    const merged = mergeIntoShell(SHELL, {
      titleTag: "<title>Contact Linklet</title>",
      metaTags: '<meta name="description" content="Page-specific description"/><meta property="og:image" content="https://linklet.org/linklet-logo.png"/>',
      bodyHtml: "<div>contact content</div>",
    });

    expect(merged.match(/name="description"/g)).toHaveLength(1);
    expect(merged.match(/property="og:image"/g)).toHaveLength(1);
    expect(merged).not.toContain("Default fallback description");
    expect(merged).toContain("Page-specific description");
  });

  it("preserves unrelated tags (theme-color, charset) that aren't part of the replaceable set", () => {
    console.log("[TEST] mergeIntoShell › leaves non-SEO meta tags untouched");
    const merged = mergeIntoShell(SHELL, {
      titleTag: "<title>Privacy Policy</title>",
      metaTags: "",
      bodyHtml: "<div>privacy content</div>",
    });

    expect(merged).toContain('name="theme-color" content="#0a0a0a"');
    expect(merged).toContain('meta charset="UTF-8"');
  });

  it("injects the rendered page markup into the #root mount point", () => {
    console.log("[TEST] mergeIntoShell › body markup lands inside <div id=\"root\">");
    const merged = mergeIntoShell(SHELL, {
      titleTag: "<title>Terms of Service</title>",
      metaTags: "",
      bodyHtml: '<div class="terms-page">Terms content</div>',
    });

    expect(merged).toContain('<div id="root"><div class="terms-page">Terms content</div></div>');
  });

  it("throws a clear error if the shell is missing the expected #root mount point, instead of silently producing broken output", () => {
    console.log("[TEST] mergeIntoShell › fails loudly on an unexpected shell shape");
    const brokenShell = SHELL.replace('<div id="root"></div>', '<div id="app"></div>');

    expect(() =>
      mergeIntoShell(brokenShell, { titleTag: "<title>X</title>", metaTags: "", bodyHtml: "<div/>" })
    ).toThrow(/root/i);
  });
});
