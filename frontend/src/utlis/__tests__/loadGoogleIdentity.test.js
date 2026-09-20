import { describe, it, expect, beforeEach, vi } from "vitest";

const freshModule = async () => {
  vi.resetModules();
  return import("../loadGoogleIdentity");
};
const gsiScripts = () => document.head.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]');

describe("loadGoogleIdentity", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    delete window.google;
  });

  it("injects the Google script only when called, and only once for concurrent callers", async () => {
    console.log("TRACE [loadGoogleIdentity.test]: lazy + de-duplicated script injection");
    const { loadGoogleIdentity } = await freshModule();
    expect(gsiScripts()).toHaveLength(0); // nothing loaded just by importing

    const a = loadGoogleIdentity();
    const b = loadGoogleIdentity();
    expect(gsiScripts()).toHaveLength(1);
    expect(a).toBe(b);

    gsiScripts()[0].onload();
    await expect(a).resolves.toBeUndefined();
  });

  it("resolves immediately without adding a script when Google is already available", async () => {
    window.google = { accounts: { id: {} } };
    const { loadGoogleIdentity } = await freshModule();
    await expect(loadGoogleIdentity()).resolves.toBeUndefined();
    expect(gsiScripts()).toHaveLength(0);
  });

  it("rejects on a network failure, cleans up, and allows a retry", async () => {
    console.log("TRACE [loadGoogleIdentity.test]: failed load can be retried");
    const { loadGoogleIdentity } = await freshModule();

    const first = loadGoogleIdentity();
    gsiScripts()[0].onerror();
    await expect(first).rejects.toThrow(/Google Sign-In/);
    expect(gsiScripts()).toHaveLength(0);

    const second = loadGoogleIdentity();
    expect(gsiScripts()).toHaveLength(1);
    gsiScripts()[0].onload();
    await expect(second).resolves.toBeUndefined();
  });
});
