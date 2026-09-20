import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import NotFound from "../NotFound";

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe("NotFound 404 Component Tests", () => {
  it("renders 404 error code and explanatory text correctly", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] NotFound › renders 404 header and description");

    render(
      <HelmetProvider>
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      </HelmetProvider>
    );

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(
      screen.getByText(/The page you are looking for might have been moved/i)
    ).toBeInTheDocument();

    console.log("[TEST] Verified 404 visual headings and explanatory copy");
  });

  it("navigates back when 'Go Back' is clicked", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] NotFound › handles 'Go Back' navigation");

    render(
      <HelmetProvider>
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      </HelmetProvider>
    );

    const goBackButton = screen.getByRole("button", { name: /Go Back/i });
    fireEvent.click(goBackButton);

    expect(mockedNavigate).toHaveBeenCalledWith(-1);
    console.log("[TEST] Successfully verified navigate(-1) triggered");
  });

  it("navigates to /home when 'Return to Feed' is clicked", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] NotFound › handles 'Return to Feed' navigation");

    render(
      <HelmetProvider>
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      </HelmetProvider>
    );

    const feedButton = screen.getByRole("button", { name: /Return to Feed/i });
    fireEvent.click(feedButton);

    expect(mockedNavigate).toHaveBeenCalledWith("/home");
    console.log("[TEST] Successfully verified navigate('/home') triggered");
  });

  it("tells crawlers not to index it (the SPA host answers unknown URLs with HTTP 200)", async () => {
    console.log("[TEST] NotFound › robots noindex");
    const { unmount } = render(
      <HelmetProvider>
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      </HelmetProvider>
    );
    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
      expect(document.title).toMatch(/not found/i);
    });
    unmount();
  });
});
