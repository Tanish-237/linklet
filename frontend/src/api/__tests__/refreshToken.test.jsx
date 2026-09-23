import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { refreshAccessToken, isAuthHandshakeError } from "../refreshToken";

vi.mock("axios");

const fakeLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
globalThis.localStorage = fakeLocalStorage;

describe("refreshToken utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("refreshAccessToken", () => {
    it("shares a single in-flight request across concurrent callers (no duplicate refresh-token rotation)", async () => {
      console.log("\n──────────────────────────────────────────────");
      console.log("[TEST] refreshAccessToken › concurrent callers share one request");
      let resolvePost;
      axios.post.mockReturnValue(
        new Promise((resolve) => { resolvePost = resolve; })
      );

      const call1 = refreshAccessToken();
      const call2 = refreshAccessToken();

      expect(axios.post).toHaveBeenCalledTimes(1);

      resolvePost({ data: { success: true } });
      const [result1, result2] = await Promise.all([call1, call2]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // Tokens are cookie-only: nothing is ever written to JS-readable storage.
      expect(localStorage.getItem("accessToken")).toBeNull();
      console.log("[TEST] Verified: only one POST /auth/refresh fired for two concurrent callers");
    });

    it("issues a new request after the previous one settles", async () => {
      console.log("[TEST] refreshAccessToken › a second call after settling triggers a fresh request");
      axios.post.mockResolvedValueOnce({ data: { success: true } });
      await refreshAccessToken();

      axios.post.mockResolvedValueOnce({ data: { success: true } });
      const result = await refreshAccessToken();

      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it("fires auth-expired when the refresh request fails", async () => {
      console.log("[TEST] refreshAccessToken › failure dispatches auth-expired");
      axios.post.mockRejectedValueOnce(new Error("refresh token invalid"));

      const listener = vi.fn();
      window.addEventListener("auth-expired", listener);

      await expect(refreshAccessToken()).rejects.toThrow("refresh token invalid");

      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener("auth-expired", listener);
    });
  });

  describe("isAuthHandshakeError", () => {
    it("recognizes token/authentication rejections as recoverable", () => {
      console.log("[TEST] isAuthHandshakeError › recognizes auth-related socket rejections");
      expect(isAuthHandshakeError({ message: "Authentication required" })).toBe(true);
      expect(isAuthHandshakeError({ message: "Invalid or expired token" })).toBe(true);
      expect(isAuthHandshakeError({ message: "Session expired" })).toBe(true);
    });

    it("does not mistake a generic connection failure for an auth failure", () => {
      console.log("[TEST] isAuthHandshakeError › ignores unrelated connection errors");
      expect(isAuthHandshakeError({ message: "xhr poll error" })).toBe(false);
      expect(isAuthHandshakeError({})).toBe(false);
    });
  });
});
