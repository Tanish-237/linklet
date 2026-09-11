import { describe, it, expect } from "vitest";
import { formatChatListTime, formatLastSeen } from "../../utlis/chatDateUtils";

describe("chatDateUtils Tests", () => {
  it("formats time for today in chat list as 12-hour time", () => {
    console.log("TRACE [ChatDateUtils.test.js]: Testing today's time formatting");
    const now = new Date();
    const result = formatChatListTime(now.toISOString());
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    console.log("TRACE [ChatDateUtils.test.js]: Today formatted as:", result);
  });

  it("formats yesterday in chat list as 'Yesterday'", () => {
    console.log("TRACE [ChatDateUtils.test.js]: Testing yesterday formatting");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatChatListTime(yesterday.toISOString());
    expect(result).toBe("Yesterday");
    console.log("TRACE [ChatDateUtils.test.js]: Yesterday verified");
  });

  it("formats older dates as DD/MM/YY", () => {
    console.log("TRACE [ChatDateUtils.test.js]: Testing older date formatting");
    const oldDate = new Date(2025, 0, 15); // Jan 15, 2025
    const result = formatChatListTime(oldDate.toISOString());
    expect(result).toBe("15/01/25");
    console.log("TRACE [ChatDateUtils.test.js]: Older date verified:", result);
  });

  it("formats last seen today", () => {
    console.log("TRACE [ChatDateUtils.test.js]: Testing last seen today");
    const now = new Date();
    const result = formatLastSeen(now.toISOString());
    expect(result).toMatch(/^last seen today at \d{1,2}:\d{2}\s*(AM|PM)$/i);
    console.log("TRACE [ChatDateUtils.test.js]: Last seen today verified:", result);
  });

  it("formats last seen yesterday", () => {
    console.log("TRACE [ChatDateUtils.test.js]: Testing last seen yesterday");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatLastSeen(yesterday.toISOString());
    expect(result).toMatch(/^last seen yesterday at \d{1,2}:\d{2}\s*(AM|PM)$/i);
    console.log("TRACE [ChatDateUtils.test.js]: Last seen yesterday verified:", result);
  });

  it("returns 'offline' when no timestamp provided", () => {
    console.log("TRACE [ChatDateUtils.test.js]: Testing missing last seen");
    expect(formatLastSeen(null)).toBe("offline");
    expect(formatLastSeen(undefined)).toBe("offline");
  });
});
