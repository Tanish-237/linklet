import { describe, it, expect } from "vitest";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../passwordPolicy";

describe("passwordPolicy — isStrongPassword", () => {
  it("accepts a password with 8+ chars, a letter, and a digit", () => {
    console.log("[TEST] isStrongPassword › accepts a compliant password");
    expect(isStrongPassword("Password1")).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    console.log("[TEST] isStrongPassword › rejects short passwords");
    expect(isStrongPassword("Ab1")).toBe(false);
  });

  it("rejects passwords missing a letter or a digit", () => {
    console.log("[TEST] isStrongPassword › rejects letters-only or digits-only passwords");
    expect(isStrongPassword("OnlyLetters")).toBe(false);
    expect(isStrongPassword("12345678")).toBe(false);
  });

  it("rejects empty or non-string input", () => {
    console.log("[TEST] isStrongPassword › rejects empty/non-string input");
    expect(isStrongPassword("")).toBe(false);
    expect(isStrongPassword(undefined)).toBe(false);
  });

  it("exposes a policy message mentioning 8 characters, a letter, and a number", () => {
    console.log("[TEST] isStrongPassword › policy message matches backend wording");
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/8 characters/i);
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/letter/i);
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/number/i);
  });
});
