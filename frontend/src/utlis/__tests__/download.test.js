import { describe, it, expect, vi, afterEach } from "vitest";
import { toDownloadUrl, downloadFile } from "../download";

const RAW = "https://res.cloudinary.com/demo/raw/upload/v1/document-123.xlsx";
const IMG = "https://res.cloudinary.com/demo/image/upload/v1/document-456.pdf";

describe("toDownloadUrl", () => {
  it("adds fl_attachment with a Cloudinary-safe name (extension is added by Cloudinary)", () => {
    expect(toDownloadUrl(RAW, "DBMS Unit 3 Notes.xlsx")).toBe(
      "https://res.cloudinary.com/demo/raw/upload/fl_attachment:DBMS_Unit_3_Notes/v1/document-123.xlsx"
    );
  });

  it("replaces an existing fl_attachment instead of stacking another", () => {
    const already = "https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/document-456.pdf";
    expect(toDownloadUrl(already, "Notes")).toBe(
      "https://res.cloudinary.com/demo/image/upload/fl_attachment:Notes/v1/document-456.pdf"
    );
  });

  it("falls back to a plain fl_attachment when there is no usable name", () => {
    expect(toDownloadUrl(IMG, "...")).toBe("https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/document-456.pdf");
    expect(toDownloadUrl(IMG)).toBe("https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/document-456.pdf");
  });

  it("leaves non-Cloudinary URLs alone", () => {
    expect(toDownloadUrl("https://example.com/a.pdf", "A")).toBe("https://example.com/a.pdf");
  });
});

describe("downloadFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saves a Cloudinary file synchronously, in the same tab, with no fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      clicked.push({ href: this.href, target: this.target });
    });

    expect(downloadFile(RAW, "Notes")).toBe(true);

    expect(clicked).toEqual([
      { href: "https://res.cloudinary.com/demo/raw/upload/fl_attachment:Notes/v1/document-123.xlsx", target: "" },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelector("a[href*='fl_attachment']")).toBeNull();
  });

  it("opens other links in a new tab and rejects unsafe URLs", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(downloadFile("https://example.com/a.pdf")).toBe(true);
    expect(open).toHaveBeenCalledWith("https://example.com/a.pdf", "_blank", "noopener,noreferrer");
    expect(downloadFile("javascript:alert(1)")).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
