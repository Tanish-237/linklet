import { describe, it, expect, vi, afterEach } from "vitest";
import { formatTime } from "../formatTime";

describe("formatTime", () => {
  afterEach(() => vi.useRealTimers());

  it("formats recent times relatively and old times as dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

    const out = {
      none: formatTime(undefined),
      now: formatTime("2025-06-15T11:59:45Z"),
      minutes: formatTime("2025-06-15T11:45:00Z"),
      hours: formatTime("2025-06-15T09:00:00Z"),
      old: formatTime("2024-01-02T00:00:00Z"),
    };
    console.log("TRACE [formatTime.test]:", JSON.stringify(out));

    expect(out.none).toBe("just now");
    expect(out.now).toBe("just now");
    expect(out.minutes).toBe("15m ago");
    expect(out.hours).toBe("3h ago");
    expect(out.old).toMatch(/2024/);
  });
});
