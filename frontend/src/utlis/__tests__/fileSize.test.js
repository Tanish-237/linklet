import { describe, it, expect } from "vitest";
import { formatFileSize } from "../fileSize";

describe("formatFileSize", () => {
  it("formats bytes with one decimal below 10 and none above", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(839680)).toBe("820 KB");
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(formatFileSize(25 * 1024 * 1024)).toBe("25 MB");
    expect(formatFileSize(1.2 * 1024 ** 3)).toBe("1.2 GB");
  });

  it("returns null when there is no size (links, not yet backfilled)", () => {
    expect(formatFileSize(undefined)).toBeNull();
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(0)).toBeNull();
  });
});
