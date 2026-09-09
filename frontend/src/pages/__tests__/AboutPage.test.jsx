import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import AboutPage from "../static/AboutPage";

describe("AboutPage Component", () => {
  it("renders the main heading, mission section, and no-scrollbar container", () => {
    console.log("TRACE [AboutPage.test.jsx]: Verifying About Linklet heading and scrollbar suppression");
    const { container } = render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
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
});
