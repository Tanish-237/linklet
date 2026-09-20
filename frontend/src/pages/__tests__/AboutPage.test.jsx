import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { describe, it, expect } from "vitest";
import AboutPage from "../static/AboutPage";

describe("AboutPage Component", () => {
  it("renders the main heading, mission section, and no-scrollbar container", () => {
    console.log("TRACE [AboutPage.test.jsx]: Verifying About Linklet heading and scrollbar suppression");
    const { container } = render(
      <HelmetProvider>
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(
      screen.getByRole("heading", { name: "About Linklet", level: 1 })
    ).toBeInTheDocument();

    console.log("TRACE [AboutPage.test.jsx]: Verifying Our Mission section renders");
    expect(
      screen.getByRole("heading", { name: "Our Mission", level: 2 })
    ).toBeInTheDocument();

    console.log("TRACE [AboutPage.test.jsx]: Verifying Contributors Are Welcome section renders");
    expect(
      screen.getByRole("heading", { name: "Contributors Are Welcome", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(/warmly welcome contributions from developers/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get in Touch \/ Contribute/i })).toBeInTheDocument();

    expect(screen.getByText(/comprehensive learning platform/i)).toBeInTheDocument();

    const pageRoot = container.querySelector(".about-page");
    expect(pageRoot).toBeInTheDocument();
    expect(pageRoot.className).toContain("no-scrollbar");

    console.log("TRACE [AboutPage.test.jsx]: Successfully verified AboutPage content, contributor section, and no-scrollbar class");
  });

  it("sets a page-specific title and absolute-URL Open Graph / Twitter card tags for link previews", async () => {
    console.log("TRACE [AboutPage.test.jsx]: Verifying Helmet injects OG/Twitter meta so shared links preview correctly");
    const { unmount } = render(
      <HelmetProvider>
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    // react-helmet-async commits to the real document.head asynchronously —
    // the whole assertion block (not just the title) must be inside waitFor
    // so it retries together instead of reading a half-committed head.
    await waitFor(() => {
      expect(document.title).toContain("About Linklet");
      expect(
        document.head.querySelector('meta[property="og:image"]')?.getAttribute("content")
      ).toBe("https://linklet.org/og-image.jpg");
      expect(
        document.head.querySelector('meta[property="og:url"]')?.getAttribute("content")
      ).toBe("https://linklet.org/about");
      expect(
        document.head.querySelector('meta[name="twitter:card"]')?.getAttribute("content")
      ).toBe("summary_large_image");
    });
    console.log("TRACE [AboutPage.test.jsx]: Confirmed og:image/og:url/twitter:card are present with absolute URLs");

    // Unmount so Helmet's cleanup removes these tags before the next test's
    // render — otherwise a stale tag here can leak into another test file's
    // document.head assertions.
    unmount();
  });
});
