import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

// A component that intentionally throws an error
const ProblemChild = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error("Simulated rendering catastrophe");
  }
  return <div>Healthy Component Content</div>;
};

describe("ErrorBoundary Component Tests", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Suppress console.error from React during intentional throw
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children normally when there is no error", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] ErrorBoundary › renders healthy child component");

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Healthy Component Content")).toBeInTheDocument();
    console.log("[TEST] Healthy child rendered without error");
  });

  it("catches errors and renders the fallback UI with error message", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] ErrorBoundary › traps error and renders recovery UI");

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/Simulated rendering catastrophe/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reload Page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Return to Home/i })).toBeInTheDocument();

    console.log("[TEST] Verified error trapping and fallback buttons");
  });

  it("renders custom fallback prop if provided", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] ErrorBoundary › supports custom fallback prop");

    render(
      <ErrorBoundary fallback={<div>Custom Error Alert</div>}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom Error Alert")).toBeInTheDocument();
    console.log("[TEST] Verified custom fallback rendered");
  });
});
