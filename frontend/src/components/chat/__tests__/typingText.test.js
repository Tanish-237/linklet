import { describe, it, expect } from "vitest";
import { formatTypingText } from "../typingText";

describe("formatTypingText", () => {
  it("says just 'typing...' in a direct chat", () => {
    expect(formatTypingText(["alice"], false)).toBe("typing...");
  });
  it("names one, two, or summarises more typers in a group", () => {
    expect(formatTypingText(["alice"], true)).toBe("alice is typing...");
    expect(formatTypingText(["alice", "bob"], true)).toBe("alice and bob are typing...");
    expect(formatTypingText(["alice", "bob", "cara"], true)).toBe("alice and 2 others are typing...");
  });
  it("is empty when nobody is typing", () => {
    expect(formatTypingText([], true)).toBe("");
  });
});
