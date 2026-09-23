import "@testing-library/jest-dom";
import { afterEach } from "vitest";

// Test isolation for browser storage. Components cache chats/messages in
// localStorage, and when a working localStorage is available (Node with
// --localstorage-file, as on CI) that state otherwise leaks from one test into
// the next. Locally Node often has no usable localStorage, which hid this.
afterEach(() => {
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      storage?.clear?.();
    } catch {
      // Storage unavailable in this environment — nothing to clear
    }
  }
});
